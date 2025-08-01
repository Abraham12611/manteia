// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SwapCoordinator
 * @dev Manages cross-chain swap lifecycle, tracks status, and handles refunds
 * Coordinates with BridgeAdapter for swap execution and provides safety mechanisms
 */
contract SwapCoordinator is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Swap states
    enum SwapState {
        INITIATED,      // Swap initiated
        SWAP_COMPLETED, // ETH->USDC or USDC->ETH swap completed
        BRIDGE_SENT,    // Bridge transaction sent
        BRIDGE_CONFIRMED, // Bridge confirmed on destination
        COMPLETED,      // Final swap completed on destination
        FAILED,         // Swap failed
        REFUNDED,       // User refunded
        EXPIRED         // Swap expired
    }

    // Swap types
    enum SwapType {
        ETH_TO_SUI,     // ETH -> USDC -> Bridge -> SUI
        SUI_TO_ETH      // SUI -> USDC -> Bridge -> ETH
    }

    // Structs
    struct CrossChainSwap {
        uint256 id;
        address user;
        SwapType swapType;
        SwapState state;
        uint256 inputAmount;
        uint256 outputAmount;
        uint256 minOutputAmount;
        uint256 usdcAmount;         // Intermediate USDC amount
        bytes32 targetAddress;      // Target address on destination chain
        uint16 targetChain;         // Wormhole chain ID
        uint256 deadline;           // Expiry timestamp
        uint256 createdAt;
        uint256 updatedAt;
        string failureReason;
        bytes32 bridgeVAA;          // Wormhole VAA hash
    }

    // State variables
    mapping(uint256 => CrossChainSwap) public swaps;
    mapping(bytes32 => uint256) public vaaToSwapId; // VAA hash to swap ID mapping
    mapping(address => uint256[]) public userSwaps;

    address public bridgeAdapter;
    uint256 public nextSwapId;
    uint256 public defaultDeadline = 24 hours; // Default swap expiry
    uint256 public refundDelay = 2 hours; // Delay before refund is allowed

    // Fee settings
    uint256 public platformFee = 10; // 0.1% in basis points
    uint256 public constant FEE_DENOMINATOR = 10000;
    address public feeCollector;

    // Events
    event SwapInitiated(
        uint256 indexed swapId,
        address indexed user,
        SwapType swapType,
        uint256 inputAmount,
        uint256 minOutputAmount,
        uint256 deadline
    );

    event SwapStateChanged(
        uint256 indexed swapId,
        SwapState oldState,
        SwapState newState,
        string reason
    );

    event SwapCompleted(
        uint256 indexed swapId,
        address indexed user,
        uint256 finalAmount
    );

    event SwapFailed(
        uint256 indexed swapId,
        address indexed user,
        string reason
    );

    event SwapRefunded(
        uint256 indexed swapId,
        address indexed user,
        uint256 refundAmount
    );

    event BridgeVAARecorded(
        uint256 indexed swapId,
        bytes32 vaaHash
    );

    // Modifiers
    modifier onlyBridgeAdapter() {
        require(msg.sender == bridgeAdapter, "Only bridge adapter");
        _;
    }

    modifier validSwap(uint256 swapId) {
        require(swapId < nextSwapId, "Invalid swap ID");
        require(swaps[swapId].user != address(0), "Swap does not exist");
        _;
    }

    modifier onlySwapUser(uint256 swapId) {
        require(swaps[swapId].user == msg.sender, "Not swap owner");
        _;
    }

    /**
     * @dev Constructor
     * @param _bridgeAdapter Address of the BridgeAdapter contract
     * @param _feeCollector Address to collect platform fees
     */
    constructor(address _bridgeAdapter, address _feeCollector) {
        require(_bridgeAdapter != address(0), "Invalid bridge adapter");
        require(_feeCollector != address(0), "Invalid fee collector");

        bridgeAdapter = _bridgeAdapter;
        feeCollector = _feeCollector;
        nextSwapId = 1;
    }

    /**
     * @dev Initiate a cross-chain swap
     * @param swapType Type of swap (ETH_TO_SUI or SUI_TO_ETH)
     * @param inputAmount Amount of input token
     * @param minOutputAmount Minimum expected output amount
     * @param targetAddress Target address on destination chain
     * @param targetChain Wormhole chain ID for destination
     * @param deadline Swap expiry timestamp
     * @return swapId Unique swap identifier
     */
    function initiateSwap(
        SwapType swapType,
        uint256 inputAmount,
        uint256 minOutputAmount,
        bytes32 targetAddress,
        uint16 targetChain,
        uint256 deadline
    ) external payable nonReentrant whenNotPaused returns (uint256 swapId) {
        require(inputAmount > 0, "Input amount must be > 0");
        require(minOutputAmount > 0, "Min output amount must be > 0");
        require(deadline > block.timestamp, "Deadline must be in future");
        require(targetAddress != bytes32(0), "Invalid target address");

        // Validate input based on swap type
        if (swapType == SwapType.ETH_TO_SUI) {
            require(msg.value == inputAmount, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "ETH not required for SUI_TO_ETH");
        }

        swapId = nextSwapId++;

        // Create swap record
        swaps[swapId] = CrossChainSwap({
            id: swapId,
            user: msg.sender,
            swapType: swapType,
            state: SwapState.INITIATED,
            inputAmount: inputAmount,
            outputAmount: 0,
            minOutputAmount: minOutputAmount,
            usdcAmount: 0,
            targetAddress: targetAddress,
            targetChain: targetChain,
            deadline: deadline,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            failureReason: "",
            bridgeVAA: bytes32(0)
        });

        // Add to user's swap list
        userSwaps[msg.sender].push(swapId);

        emit SwapInitiated(
            swapId,
            msg.sender,
            swapType,
            inputAmount,
            minOutputAmount,
            deadline
        );

        // Update state to INITIATED
        _updateSwapState(swapId, SwapState.INITIATED, "Swap initiated");
    }

    /**
     * @dev Update swap state (called by BridgeAdapter or authorized parties)
     * @param swapId Swap identifier
     * @param newState New swap state
     * @param reason Reason for state change
     */
    function updateSwapState(
        uint256 swapId,
        SwapState newState,
        string calldata reason
    ) external onlyBridgeAdapter validSwap(swapId) {
        _updateSwapState(swapId, newState, reason);
    }

    /**
     * @dev Record bridge VAA hash
     * @param swapId Swap identifier
     * @param vaaHash Wormhole VAA hash
     */
    function recordBridgeVAA(
        uint256 swapId,
        bytes32 vaaHash
    ) external onlyBridgeAdapter validSwap(swapId) {
        require(vaaHash != bytes32(0), "Invalid VAA hash");

        swaps[swapId].bridgeVAA = vaaHash;
        swaps[swapId].updatedAt = block.timestamp;
        vaaToSwapId[vaaHash] = swapId;

        emit BridgeVAARecorded(swapId, vaaHash);
        _updateSwapState(swapId, SwapState.BRIDGE_SENT, "Bridge VAA recorded");
    }

    /**
     * @dev Update USDC amount after swap
     * @param swapId Swap identifier
     * @param usdcAmount Amount of USDC received/sent
     */
    function updateUSDCAmount(
        uint256 swapId,
        uint256 usdcAmount
    ) external onlyBridgeAdapter validSwap(swapId) {
        swaps[swapId].usdcAmount = usdcAmount;
        swaps[swapId].updatedAt = block.timestamp;
        _updateSwapState(swapId, SwapState.SWAP_COMPLETED, "USDC swap completed");
    }

    /**
     * @dev Complete swap with final output amount
     * @param swapId Swap identifier
     * @param finalAmount Final amount received by user
     */
    function completeSwap(
        uint256 swapId,
        uint256 finalAmount
    ) external onlyBridgeAdapter validSwap(swapId) {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.state != SwapState.COMPLETED, "Swap already completed");
        require(swap.state != SwapState.FAILED, "Swap failed");

        swap.outputAmount = finalAmount;
        swap.updatedAt = block.timestamp;

        _updateSwapState(swapId, SwapState.COMPLETED, "Swap completed successfully");

        emit SwapCompleted(swapId, swap.user, finalAmount);
    }

    /**
     * @dev Mark swap as failed
     * @param swapId Swap identifier
     * @param reason Failure reason
     */
    function failSwap(
        uint256 swapId,
        string calldata reason
    ) external onlyBridgeAdapter validSwap(swapId) {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.state != SwapState.COMPLETED, "Swap already completed");
        require(swap.state != SwapState.FAILED, "Swap already failed");

        swap.failureReason = reason;
        swap.updatedAt = block.timestamp;

        _updateSwapState(swapId, SwapState.FAILED, reason);

        emit SwapFailed(swapId, swap.user, reason);
    }

    /**
     * @dev Request refund for failed or expired swap
     * @param swapId Swap identifier
     */
    function requestRefund(uint256 swapId)
        external
        nonReentrant
        validSwap(swapId)
        onlySwapUser(swapId)
    {
        CrossChainSwap storage swap = swaps[swapId];

        require(
            swap.state == SwapState.FAILED ||
            block.timestamp > swap.deadline ||
            (swap.state == SwapState.INITIATED && block.timestamp > swap.createdAt + refundDelay),
            "Refund not allowed yet"
        );

        require(swap.state != SwapState.REFUNDED, "Already refunded");
        require(swap.state != SwapState.COMPLETED, "Swap completed");

        // Calculate refund amount (deduct platform fee if swap was attempted)
        uint256 refundAmount = swap.inputAmount;
        if (swap.state != SwapState.INITIATED) {
            uint256 fee = (refundAmount * platformFee) / FEE_DENOMINATOR;
            refundAmount -= fee;

            // Transfer fee to fee collector
            if (swap.swapType == SwapType.ETH_TO_SUI) {
                payable(feeCollector).transfer(fee);
            }
        }

        // Update state
        swap.outputAmount = refundAmount;
        swap.updatedAt = block.timestamp;
        _updateSwapState(swapId, SwapState.REFUNDED, "Refund processed");

        // Execute refund
        if (swap.swapType == SwapType.ETH_TO_SUI) {
            payable(swap.user).transfer(refundAmount);
        } else {
            // For SUI_TO_ETH, USDC refund would be handled by bridge adapter
            // This is a placeholder - actual implementation depends on bridge mechanics
            revert("SUI_TO_ETH refunds not implemented");
        }

        emit SwapRefunded(swapId, swap.user, refundAmount);
    }

    /**
     * @dev Expire old swaps (cleanup function)
     * @param swapIds Array of swap IDs to expire
     */
    function expireSwaps(uint256[] calldata swapIds) external {
        for (uint256 i = 0; i < swapIds.length; i++) {
            uint256 swapId = swapIds[i];
            if (swapId < nextSwapId && swaps[swapId].user != address(0)) {
                CrossChainSwap storage swap = swaps[swapId];

                if (block.timestamp > swap.deadline &&
                    swap.state != SwapState.COMPLETED &&
                    swap.state != SwapState.FAILED &&
                    swap.state != SwapState.REFUNDED &&
                    swap.state != SwapState.EXPIRED) {

                    _updateSwapState(swapId, SwapState.EXPIRED, "Swap expired");
                }
            }
        }
    }

    /**
     * @dev Get swap details
     * @param swapId Swap identifier
     * @return swap Complete swap information
     */
    function getSwap(uint256 swapId) external view validSwap(swapId) returns (CrossChainSwap memory) {
        return swaps[swapId];
    }

    /**
     * @dev Get user's swap IDs
     * @param user User address
     * @return swapIds Array of swap IDs for the user
     */
    function getUserSwaps(address user) external view returns (uint256[] memory) {
        return userSwaps[user];
    }

    /**
     * @dev Get swap ID by VAA hash
     * @param vaaHash Wormhole VAA hash
     * @return swapId Swap identifier
     */
    function getSwapByVAA(bytes32 vaaHash) external view returns (uint256) {
        return vaaToSwapId[vaaHash];
    }

    /**
     * @dev Check if swap is refundable
     * @param swapId Swap identifier
     * @return refundable Whether the swap can be refunded
     */
    function isRefundable(uint256 swapId) external view validSwap(swapId) returns (bool) {
        CrossChainSwap storage swap = swaps[swapId];

        return (
            swap.state == SwapState.FAILED ||
            block.timestamp > swap.deadline ||
            (swap.state == SwapState.INITIATED && block.timestamp > swap.createdAt + refundDelay)
        ) && swap.state != SwapState.REFUNDED && swap.state != SwapState.COMPLETED;
    }

    /**
     * @dev Internal function to update swap state
     * @param swapId Swap identifier
     * @param newState New state
     * @param reason Reason for change
     */
    function _updateSwapState(uint256 swapId, SwapState newState, string memory reason) internal {
        CrossChainSwap storage swap = swaps[swapId];
        SwapState oldState = swap.state;

        swap.state = newState;
        swap.updatedAt = block.timestamp;

        emit SwapStateChanged(swapId, oldState, newState, reason);
    }

    /**
     * @dev Set bridge adapter address (only owner)
     * @param _bridgeAdapter New bridge adapter address
     */
    function setBridgeAdapter(address _bridgeAdapter) external onlyOwner {
        require(_bridgeAdapter != address(0), "Invalid bridge adapter");
        bridgeAdapter = _bridgeAdapter;
    }

    /**
     * @dev Set platform fee (only owner)
     * @param _platformFee New platform fee in basis points
     */
    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 100, "Fee too high"); // Max 1%
        platformFee = _platformFee;
    }

    /**
     * @dev Set fee collector (only owner)
     * @param _feeCollector New fee collector address
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
    }

    /**
     * @dev Set default deadline (only owner)
     * @param _defaultDeadline New default deadline in seconds
     */
    function setDefaultDeadline(uint256 _defaultDeadline) external onlyOwner {
        require(_defaultDeadline >= 1 hours && _defaultDeadline <= 7 days, "Invalid deadline");
        defaultDeadline = _defaultDeadline;
    }

    /**
     * @dev Set refund delay (only owner)
     * @param _refundDelay New refund delay in seconds
     */
    function setRefundDelay(uint256 _refundDelay) external onlyOwner {
        require(_refundDelay >= 30 minutes && _refundDelay <= 24 hours, "Invalid delay");
        refundDelay = _refundDelay;
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
     * @dev Emergency withdrawal (only owner)
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
            require(amount <= address(this).balance, "Insufficient balance");
            payable(to).transfer(amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {
        // Allow contract to receive ETH
    }
}