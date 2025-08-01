// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// 1inch Router interface
interface IOneInchRouter {
    function swap(
        address caller,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);
}

struct SwapDescription {
    address srcToken;
    address dstToken;
    address srcReceiver;
    address dstReceiver;
    uint256 amount;
    uint256 minReturnAmount;
    uint256 flags;
}

// Wormhole TokenBridge interface
interface IWormholeTokenBridge {
    function transferTokens(
        address token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence);

    function wrapAndTransferETH(
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence);
}

/**
 * @title BridgeAdapter
 * @dev Contract to interface with 1inch Router and Wormhole TokenBridge for cross-chain swaps
 * Handles ETH→USDC swaps via 1inch and USDC bridging via Wormhole
 */
contract BridgeAdapter is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // 1inch Router v5 address (same for mainnet and testnets)
    address public constant ONEINCH_ROUTER = 0x1111111254fb6c44bAC0beD2854e76F90643097d;

    // Wormhole TokenBridge addresses
    address public immutable WORMHOLE_TOKEN_BRIDGE;

    // USDC token address
    address public immutable USDC_TOKEN;

    // ETH placeholder address used by 1inch
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Events
    event SwapInitiated(
        address indexed user,
        uint256 indexed swapId,
        address srcToken,
        address dstToken,
        uint256 srcAmount,
        uint256 expectedDstAmount
    );

    event SwapCompleted(
        address indexed user,
        uint256 indexed swapId,
        uint256 actualDstAmount
    );

    event BridgeInitiated(
        address indexed user,
        uint256 indexed swapId,
        uint256 amount,
        uint16 targetChain,
        bytes32 targetAddress
    );

    event SwapFailed(
        address indexed user,
        uint256 indexed swapId,
        string reason
    );

    // Structs
    struct SwapParams {
        address srcToken;
        address dstToken;
        uint256 srcAmount;
        uint256 minDstAmount;
        bytes swapData;
    }

    struct BridgeParams {
        uint256 amount;
        uint16 targetChain; // Wormhole chain ID
        bytes32 targetAddress;
        uint32 nonce;
    }

    // State variables
    mapping(uint256 => address) public swapOwners;
    mapping(address => bool) public authorizedCallers;
    uint256 public nextSwapId;



    /**
     * @dev Constructor
     * @param _wormholeTokenBridge Wormhole TokenBridge contract address
     * @param _usdcToken USDC token contract address
     */
    constructor(
        address _wormholeTokenBridge,
        address _usdcToken
    ) Ownable(msg.sender) {
        require(_wormholeTokenBridge != address(0), "Invalid Wormhole TokenBridge address");
        require(_usdcToken != address(0), "Invalid USDC token address");

        WORMHOLE_TOKEN_BRIDGE = _wormholeTokenBridge;
        USDC_TOKEN = _usdcToken;
        nextSwapId = 1;
    }

    /**
     * @dev Execute ETH to USDC swap and bridge to target chain
     * @param swapParams Parameters for the 1inch swap
     * @param bridgeParams Parameters for Wormhole bridge
     */
    function swapAndBridge(
        SwapParams calldata swapParams,
        BridgeParams calldata bridgeParams
    ) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "ETH amount required");
        require(swapParams.srcToken == ETH_ADDRESS, "Source token must be ETH");
        require(swapParams.dstToken == USDC_TOKEN, "Destination token must be USDC");
        require(swapParams.srcAmount == msg.value, "ETH amount mismatch");

        uint256 swapId = nextSwapId++;
        swapOwners[swapId] = msg.sender;

        emit SwapInitiated(
            msg.sender,
            swapId,
            swapParams.srcToken,
            swapParams.dstToken,
            swapParams.srcAmount,
            swapParams.minDstAmount
        );

        try this._executeSwapAndBridge{value: msg.value}(
            swapId,
            swapParams,
            bridgeParams
        ) {
            // Success - events emitted in _executeSwapAndBridge
        } catch Error(string memory reason) {
            emit SwapFailed(msg.sender, swapId, reason);
            // Refund ETH to user
            payable(msg.sender).transfer(msg.value);
            revert(reason);
        } catch {
            emit SwapFailed(msg.sender, swapId, "Unknown error");
            // Refund ETH to user
            payable(msg.sender).transfer(msg.value);
            revert("Swap failed");
        }
    }

    /**
     * @dev Internal function to execute swap and bridge (external for try-catch)
     * @param swapId Unique swap identifier
     * @param swapParams Parameters for the 1inch swap
     * @param bridgeParams Parameters for Wormhole bridge
     */
    function _executeSwapAndBridge(
        uint256 swapId,
        SwapParams calldata swapParams,
        BridgeParams calldata bridgeParams
    ) external payable {
        require(msg.sender == address(this), "Only self-call allowed");

        // Execute 1inch swap: ETH → USDC
        uint256 usdcReceived = _executeOneInchSwap(swapParams);

        emit SwapCompleted(swapOwners[swapId], swapId, usdcReceived);

        // Bridge USDC to target chain via Wormhole
        _executeBridge(swapId, usdcReceived, bridgeParams);
    }

    /**
     * @dev Execute 1inch swap
     * @param swapParams Swap parameters
     * @return usdcAmount Amount of USDC received
     */
    function _executeOneInchSwap(SwapParams calldata swapParams)
        internal
        returns (uint256 usdcAmount)
    {
        // Prepare swap description
        SwapDescription memory desc = SwapDescription({
            srcToken: swapParams.srcToken,
            dstToken: swapParams.dstToken,
            srcReceiver: payable(address(this)),
            dstReceiver: payable(address(this)),
            amount: swapParams.srcAmount,
            minReturnAmount: swapParams.minDstAmount,
            flags: 0
        });

        uint256 usdcBalanceBefore = IERC20(USDC_TOKEN).balanceOf(address(this));

        // Execute swap via 1inch router
        IOneInchRouter(ONEINCH_ROUTER).swap{value: msg.value}(
            address(this),
            desc,
            "",
            swapParams.swapData
        );

        uint256 usdcBalanceAfter = IERC20(USDC_TOKEN).balanceOf(address(this));
        usdcAmount = usdcBalanceAfter - usdcBalanceBefore;

        require(usdcAmount >= swapParams.minDstAmount, "Insufficient USDC received");
    }

    /**
     * @dev Execute Wormhole bridge
     * @param swapId Swap identifier for events
     * @param amount USDC amount to bridge
     * @param bridgeParams Bridge parameters
     */
    function _executeBridge(
        uint256 swapId,
        uint256 amount,
        BridgeParams calldata bridgeParams
    ) internal {
        require(amount > 0, "No USDC to bridge");

        // Approve Wormhole TokenBridge to spend USDC
        IERC20(USDC_TOKEN).forceApprove(WORMHOLE_TOKEN_BRIDGE, amount);

        // Execute bridge via Wormhole
        IWormholeTokenBridge(WORMHOLE_TOKEN_BRIDGE).transferTokens(
            USDC_TOKEN,
            amount,
            bridgeParams.targetChain,
            bridgeParams.targetAddress,
            0, // No arbiter fee
            bridgeParams.nonce
        );

        emit BridgeInitiated(
            swapOwners[swapId],
            swapId,
            amount,
            bridgeParams.targetChain,
            bridgeParams.targetAddress
        );
    }

    /**
     * @dev Bridge USDC directly (for reverse swaps from Sui)
     * @param amount USDC amount to bridge
     * @param bridgeParams Bridge parameters
     */
    function bridgeUSDC(
        uint256 amount,
        BridgeParams calldata bridgeParams
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");

        uint256 swapId = nextSwapId++;
        swapOwners[swapId] = msg.sender;

        // Transfer USDC from user to this contract
        IERC20(USDC_TOKEN).safeTransferFrom(msg.sender, address(this), amount);

        // Execute bridge
        _executeBridge(swapId, amount, bridgeParams);
    }

    /**
     * @dev Execute USDC to ETH swap (for completing reverse flow)
     * @param swapParams Swap parameters
     */
    function swapUSDCToETH(SwapParams calldata swapParams)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 ethAmount)
    {
        require(swapParams.srcToken == USDC_TOKEN, "Source token must be USDC");
        require(swapParams.dstToken == ETH_ADDRESS, "Destination token must be ETH");
        require(swapParams.srcAmount > 0, "Amount must be greater than 0");

        uint256 swapId = nextSwapId++;
        swapOwners[swapId] = msg.sender;

        emit SwapInitiated(
            msg.sender,
            swapId,
            swapParams.srcToken,
            swapParams.dstToken,
            swapParams.srcAmount,
            swapParams.minDstAmount
        );

        // Transfer USDC from user
        IERC20(USDC_TOKEN).safeTransferFrom(msg.sender, address(this), swapParams.srcAmount);

        // Approve 1inch router to spend USDC
        IERC20(USDC_TOKEN).forceApprove(ONEINCH_ROUTER, swapParams.srcAmount);

        // Prepare swap description
        SwapDescription memory desc = SwapDescription({
            srcToken: swapParams.srcToken,
            dstToken: swapParams.dstToken,
            srcReceiver: payable(address(this)),
            dstReceiver: payable(msg.sender),
            amount: swapParams.srcAmount,
            minReturnAmount: swapParams.minDstAmount,
            flags: 0
        });

        uint256 ethBalanceBefore = address(this).balance;

        // Execute swap
        IOneInchRouter(ONEINCH_ROUTER).swap(
            address(this),
            desc,
            "",
            swapParams.swapData
        );

        ethAmount = address(this).balance - ethBalanceBefore;
        require(ethAmount >= swapParams.minDstAmount, "Insufficient ETH received");

        emit SwapCompleted(msg.sender, swapId, ethAmount);

        // Transfer ETH to user (already done by 1inch if dstReceiver is user)
        if (address(this).balance > 0) {
            payable(msg.sender).transfer(address(this).balance);
        }
    }

    /**
     * @dev Emergency withdrawal function (only owner)
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        if (token == address(0)) {
            // Withdraw ETH
            require(amount <= address(this).balance, "Insufficient ETH balance");
            payable(to).transfer(amount);
        } else {
            // Withdraw ERC20 token
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @dev Set authorized caller status
     * @param caller Address to authorize/unauthorize
     * @param authorized Authorization status
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    /**
     * @dev Pause contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get swap owner
     * @param swapId Swap identifier
     * @return owner Address of swap owner
     */
    function getSwapOwner(uint256 swapId) external view returns (address) {
        return swapOwners[swapId];
    }

    /**
     * @dev Check if address is authorized caller
     * @param caller Address to check
     * @return authorized Authorization status
     */
    function isAuthorizedCaller(address caller) external view returns (bool) {
        return authorizedCallers[caller];
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {
        // Allow contract to receive ETH
    }

    /**
     * @dev Fallback function
     */
    fallback() external payable {
        revert("Function not found");
    }
}