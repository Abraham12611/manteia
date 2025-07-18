// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MarketHub is ERC1155, ERC1155Supply, Ownable, ReentrancyGuard, Pausable {
    using Strings for uint256;

    // Token IDs: For each market, YES = marketId + 1, NO = marketId + 2
    uint256 constant public YES_TOKEN_OFFSET = 1;
    uint256 constant public NO_TOKEN_OFFSET = 2;

    // Market structure
    struct Market {
        string title;
        string description;
        string category;
        uint256 endDate;
        bool resolved;
        bool outcome; // true = YES wins, false = NO wins
        uint256 totalVolume;
        uint256 yesVolume;
        uint256 noVolume;
        uint256 createdAt;
        address creator;
        string[] tags;
        string resolutionCriteria;
    }

    // Order structure
    struct Order {
        address trader;
        uint256 marketId;
        bool outcome; // true for YES, false for NO
        uint256 price; // Price in wei (0 to 1 ether)
        uint256 size; // Number of shares
        uint256 filledSize;
        uint256 timestamp;
        bool active;
        OrderType orderType;
    }

    enum OrderType { MARKET, LIMIT }

    // State variables
    mapping(uint256 => Market) public markets;
    mapping(uint256 => Order[]) public yesOrders;
    mapping(uint256 => Order[]) public noOrders;
    mapping(address => uint256) public userCollateral;
    mapping(uint256 => uint256) public marketCollateral;
    mapping(uint256 => uint256) public lastTradedPrice;
    mapping(address => mapping(uint256 => uint256)) public userOrderCount;

    uint256 public nextMarketId = 1;
    uint256 public nextOrderId = 1;
    uint256 public manteiaFee = 200; // 2% in basis points
    uint256 public constant MAX_PRICE = 1 ether;
    uint256 public constant MIN_ORDER_SIZE = 1;

    // Events
    event MarketCreated(
        uint256 indexed marketId,
        string title,
        string category,
        uint256 endDate,
        address creator
    );

    event OrderPlaced(
        uint256 indexed orderId,
        uint256 indexed marketId,
        address indexed trader,
        bool outcome,
        uint256 price,
        uint256 size,
        OrderType orderType
    );

    event OrderMatched(
        uint256 indexed marketId,
        address indexed maker,
        address indexed taker,
        bool outcome,
        uint256 price,
        uint256 size,
        uint256 makerFee,
        uint256 takerFee
    );

    event MarketResolved(
        uint256 indexed marketId,
        bool outcome,
        uint256 totalVolume
    );

    event SharesRedeemed(
        uint256 indexed marketId,
        address indexed user,
        uint256 yesShares,
        uint256 noShares,
        uint256 payout
    );

    event CollateralDeposited(
        address indexed user,
        uint256 amount
    );

    event CollateralWithdrawn(
        address indexed user,
        uint256 amount
    );

    constructor() ERC1155("") {
        _transferOwnership(msg.sender);
    }

    // Modifiers
    modifier validMarket(uint256 marketId) {
        require(markets[marketId].endDate > 0, "Market does not exist");
        require(markets[marketId].endDate > block.timestamp, "Market has ended");
        require(!markets[marketId].resolved, "Market is resolved");
        _;
    }

    modifier validPrice(uint256 price) {
        require(price > 0 && price < MAX_PRICE, "Invalid price");
        _;
    }

    modifier validSize(uint256 size) {
        require(size >= MIN_ORDER_SIZE, "Size too small");
        _;
    }

    // Deposit MNT collateral
    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit some MNT");
        userCollateral[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    // Withdraw MNT collateral
    function withdrawCollateral(uint256 amount) external nonReentrant {
        require(userCollateral[msg.sender] >= amount, "Insufficient collateral");
        userCollateral[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit CollateralWithdrawn(msg.sender, amount);
    }

    // Create a new market
    function createMarket(
        string memory title,
        string memory description,
        string memory category,
        uint256 endDate,
        string[] memory tags,
        string memory resolutionCriteria
    ) external onlyOwner returns (uint256) {
        require(endDate > block.timestamp, "End date must be in future");
        require(bytes(title).length > 0, "Title cannot be empty");

        uint256 marketId = nextMarketId++;

        markets[marketId] = Market({
            title: title,
            description: description,
            category: category,
            endDate: endDate,
            resolved: false,
            outcome: false,
            totalVolume: 0,
            yesVolume: 0,
            noVolume: 0,
            createdAt: block.timestamp,
            creator: msg.sender,
            tags: tags,
            resolutionCriteria: resolutionCriteria
        });

        // Initialize price at 50/50
        lastTradedPrice[marketId] = MAX_PRICE / 2;

        emit MarketCreated(marketId, title, category, endDate, msg.sender);
        return marketId;
    }

    // Place an order
    function placeOrder(
        uint256 marketId,
        bool outcome,
        uint256 price,
        uint256 size,
        OrderType orderType
    ) external payable validMarket(marketId) validPrice(price) validSize(size) nonReentrant {

        // Calculate required collateral
        uint256 requiredCollateral = calculateRequiredCollateral(price, size, outcome);

        // Check if user has enough collateral (including any MNT sent with transaction)
        uint256 totalAvailable = userCollateral[msg.sender] + msg.value;
        require(totalAvailable >= requiredCollateral, "Insufficient collateral");

        // Add sent MNT to user's collateral
        if (msg.value > 0) {
            userCollateral[msg.sender] += msg.value;
        }

        // Try to match order immediately if it's a market order
        if (orderType == OrderType.MARKET) {
            _executeMarketOrder(marketId, msg.sender, outcome, size);
        } else {
            // For limit orders, try to match then add to book
            uint256 remainingSize = _tryMatchOrder(marketId, msg.sender, outcome, price, size);

            if (remainingSize > 0) {
                _addToOrderBook(marketId, msg.sender, outcome, price, remainingSize, orderType);
            }
        }
    }

    // Calculate required collateral for an order
    function calculateRequiredCollateral(uint256 price, uint256 size, bool outcome) public pure returns (uint256) {
        // For YES orders: collateral = price * size
        // For NO orders: collateral = (1 - price) * size
        if (outcome) {
            return (price * size) / 1 ether;
        } else {
            return ((MAX_PRICE - price) * size) / 1 ether;
        }
    }

    // Execute a market order
    function _executeMarketOrder(
        uint256 marketId,
        address trader,
        bool outcome,
        uint256 size
    ) internal {
        Order[] storage oppositeOrders = outcome ? noOrders[marketId] : yesOrders[marketId];

        uint256 remainingSize = size;
        uint256 i = 0;

        while (i < oppositeOrders.length && remainingSize > 0) {
            Order storage order = oppositeOrders[i];

            if (order.active && order.size > order.filledSize) {
                uint256 availableSize = order.size - order.filledSize;
                uint256 matchSize = remainingSize > availableSize ? availableSize : remainingSize;

                // Execute the trade
                _executeTrade(marketId, order.trader, trader, outcome, order.price, matchSize);

                order.filledSize += matchSize;
                remainingSize -= matchSize;

                // Deactivate order if fully filled
                if (order.filledSize >= order.size) {
                    order.active = false;
                }
            }
            i++;
        }

        require(remainingSize == 0, "Cannot fill market order completely");
    }

    // Try to match a limit order
    function _tryMatchOrder(
        uint256 marketId,
        address trader,
        bool outcome,
        uint256 price,
        uint256 size
    ) internal returns (uint256) {
        Order[] storage oppositeOrders = outcome ? noOrders[marketId] : yesOrders[marketId];

        uint256 remainingSize = size;
        uint256 i = 0;

        while (i < oppositeOrders.length && remainingSize > 0) {
            Order storage order = oppositeOrders[i];

            if (order.active && order.size > order.filledSize) {
                // Check if prices are compatible (YES price + NO price = 1 ether)
                uint256 complementaryPrice = MAX_PRICE - price;

                if (order.price <= complementaryPrice) {
                    uint256 availableSize = order.size - order.filledSize;
                    uint256 matchSize = remainingSize > availableSize ? availableSize : remainingSize;

                    // Execute the trade at the maker's price
                    _executeTrade(marketId, order.trader, trader, outcome, order.price, matchSize);

                    order.filledSize += matchSize;
                    remainingSize -= matchSize;

                    // Deactivate order if fully filled
                    if (order.filledSize >= order.size) {
                        order.active = false;
                    }
                }
            }
            i++;
        }

        return remainingSize;
    }

    // Add order to order book
    function _addToOrderBook(
        uint256 marketId,
        address trader,
        bool outcome,
        uint256 price,
        uint256 size,
        OrderType orderType
    ) internal {
        Order memory newOrder = Order({
            trader: trader,
            marketId: marketId,
            outcome: outcome,
            price: price,
            size: size,
            filledSize: 0,
            timestamp: block.timestamp,
            active: true,
            orderType: orderType
        });

        if (outcome) {
            yesOrders[marketId].push(newOrder);
        } else {
            noOrders[marketId].push(newOrder);
        }

        uint256 orderId = nextOrderId++;
        userOrderCount[trader][marketId]++;

        emit OrderPlaced(orderId, marketId, trader, outcome, price, size, orderType);
    }

    // Execute a trade between two users
    function _executeTrade(
        uint256 marketId,
        address maker,
        address taker,
        bool outcome,
        uint256 price,
        uint256 size
    ) internal {
        // Calculate fees
        uint256 makerFee = 0; // 0% maker fee
        uint256 takerFee = 0; // 0% taker fee
        uint256 totalFee = (size * manteiaFee) / 10000; // Platform fee

        // Deduct collateral from users
        uint256 makerCollateral = calculateRequiredCollateral(MAX_PRICE - price, size, !outcome);
        uint256 takerCollateral = calculateRequiredCollateral(price, size, outcome);

        require(userCollateral[maker] >= makerCollateral, "Maker insufficient collateral");
        require(userCollateral[taker] >= takerCollateral, "Taker insufficient collateral");

        userCollateral[maker] -= makerCollateral;
        userCollateral[taker] -= takerCollateral;

        // Add to market collateral (minus fees)
        marketCollateral[marketId] += makerCollateral + takerCollateral - totalFee;

        // Mint shares
        uint256 yesTokenId = marketId * 10 + YES_TOKEN_OFFSET;
        uint256 noTokenId = marketId * 10 + NO_TOKEN_OFFSET;

        if (outcome) {
            _mint(taker, yesTokenId, size, "");
            _mint(maker, noTokenId, size, "");
        } else {
            _mint(maker, yesTokenId, size, "");
            _mint(taker, noTokenId, size, "");
        }

        // Update market stats
        markets[marketId].totalVolume += size;
        if (outcome) {
            markets[marketId].yesVolume += size;
        } else {
            markets[marketId].noVolume += size;
        }

        lastTradedPrice[marketId] = price;

        emit OrderMatched(marketId, maker, taker, outcome, price, size, makerFee, takerFee);
    }

    // Resolve a market
    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        require(markets[marketId].endDate > 0, "Market does not exist");
        require(!markets[marketId].resolved, "Market already resolved");

        markets[marketId].resolved = true;
        markets[marketId].outcome = outcome;

        emit MarketResolved(marketId, outcome, markets[marketId].totalVolume);
    }

    // Redeem winning shares
    function redeemShares(uint256 marketId) external nonReentrant {
        require(markets[marketId].resolved, "Market not resolved");

        uint256 yesTokenId = marketId * 10 + YES_TOKEN_OFFSET;
        uint256 noTokenId = marketId * 10 + NO_TOKEN_OFFSET;

        uint256 yesShares = balanceOf(msg.sender, yesTokenId);
        uint256 noShares = balanceOf(msg.sender, noTokenId);

        require(yesShares > 0 || noShares > 0, "No shares to redeem");

        uint256 payout = 0;

        if (markets[marketId].outcome) {
            // YES won, redeem YES shares
            payout = yesShares;
            if (yesShares > 0) {
                _burn(msg.sender, yesTokenId, yesShares);
            }
        } else {
            // NO won, redeem NO shares
            payout = noShares;
            if (noShares > 0) {
                _burn(msg.sender, noTokenId, noShares);
            }
        }

        // Burn losing shares
        if (markets[marketId].outcome && noShares > 0) {
            _burn(msg.sender, noTokenId, noShares);
        } else if (!markets[marketId].outcome && yesShares > 0) {
            _burn(msg.sender, yesTokenId, yesShares);
        }

        // Transfer payout
        if (payout > 0) {
            userCollateral[msg.sender] += payout;
        }

        emit SharesRedeemed(marketId, msg.sender, yesShares, noShares, payout);
    }

    // Get market price (midpoint of best bid/ask)
    function getMarketPrice(uint256 marketId) external view returns (uint256) {
        uint256 bestBid = getBestBid(marketId);
        uint256 bestAsk = getBestAsk(marketId);

        if (bestBid == 0 && bestAsk == 0) {
            return lastTradedPrice[marketId] > 0 ? lastTradedPrice[marketId] : MAX_PRICE / 2;
        }

        if (bestAsk - bestBid > 0.1 ether) {
            return lastTradedPrice[marketId];
        }

        return (bestBid + bestAsk) / 2;
    }

    // Get best bid price
    function getBestBid(uint256 marketId) public view returns (uint256) {
        uint256 bestBid = 0;
        Order[] storage yesOrdersArray = yesOrders[marketId];

        for (uint256 i = 0; i < yesOrdersArray.length; i++) {
            if (yesOrdersArray[i].active && yesOrdersArray[i].size > yesOrdersArray[i].filledSize) {
                if (yesOrdersArray[i].price > bestBid) {
                    bestBid = yesOrdersArray[i].price;
                }
            }
        }

        return bestBid;
    }

    // Get best ask price
    function getBestAsk(uint256 marketId) public view returns (uint256) {
        uint256 bestAsk = MAX_PRICE;
        Order[] storage noOrdersArray = noOrders[marketId];

        for (uint256 i = 0; i < noOrdersArray.length; i++) {
            if (noOrdersArray[i].active && noOrdersArray[i].size > noOrdersArray[i].filledSize) {
                uint256 complementaryPrice = MAX_PRICE - noOrdersArray[i].price;
                if (complementaryPrice < bestAsk) {
                    bestAsk = complementaryPrice;
                }
            }
        }

        return bestAsk == MAX_PRICE ? 0 : bestAsk;
    }

    // Get order book for a market
    function getOrderBook(uint256 marketId) external view returns (
        uint256[] memory bidPrices,
        uint256[] memory bidSizes,
        uint256[] memory askPrices,
        uint256[] memory askSizes
    ) {
        Order[] storage yesOrdersArray = yesOrders[marketId];
        Order[] storage noOrdersArray = noOrders[marketId];

        // Count active orders
        uint256 bidCount = 0;
        uint256 askCount = 0;

        for (uint256 i = 0; i < yesOrdersArray.length; i++) {
            if (yesOrdersArray[i].active && yesOrdersArray[i].size > yesOrdersArray[i].filledSize) {
                bidCount++;
            }
        }

        for (uint256 i = 0; i < noOrdersArray.length; i++) {
            if (noOrdersArray[i].active && noOrdersArray[i].size > noOrdersArray[i].filledSize) {
                askCount++;
            }
        }

        // Create arrays
        bidPrices = new uint256[](bidCount);
        bidSizes = new uint256[](bidCount);
        askPrices = new uint256[](askCount);
        askSizes = new uint256[](askCount);

        // Fill bid arrays (YES orders)
        uint256 bidIndex = 0;
        for (uint256 i = 0; i < yesOrdersArray.length; i++) {
            if (yesOrdersArray[i].active && yesOrdersArray[i].size > yesOrdersArray[i].filledSize) {
                bidPrices[bidIndex] = yesOrdersArray[i].price;
                bidSizes[bidIndex] = yesOrdersArray[i].size - yesOrdersArray[i].filledSize;
                bidIndex++;
            }
        }

        // Fill ask arrays (NO orders converted to YES equivalent)
        uint256 askIndex = 0;
        for (uint256 i = 0; i < noOrdersArray.length; i++) {
            if (noOrdersArray[i].active && noOrdersArray[i].size > noOrdersArray[i].filledSize) {
                askPrices[askIndex] = MAX_PRICE - noOrdersArray[i].price;
                askSizes[askIndex] = noOrdersArray[i].size - noOrdersArray[i].filledSize;
                askIndex++;
            }
        }

        return (bidPrices, bidSizes, askPrices, askSizes);
    }

    // Get market information
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    // Get user's collateral balance
    function getUserCollateral(address user) external view returns (uint256) {
        return userCollateral[user];
    }

    // Emergency functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setManteiaFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee cannot exceed 5%");
        manteiaFee = newFee;
    }

    // Required overrides
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // URI for metadata
    function uri(uint256 tokenId) public view override returns (string memory) {
        uint256 marketId = tokenId / 10;
        uint256 outcome = tokenId % 10;

        return string(abi.encodePacked(
            "https://api.manteia.xyz/metadata/",
            marketId.toString(),
            "/",
            outcome.toString()
        ));
    }
}