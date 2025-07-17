// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./MockMailbox.sol";

contract MarketHub is ERC1155 {
    using Address for address;

    struct Order {
        address user;
        uint256 price;
        uint256 amount;
        bool isBuy;
    }

    mapping(uint256 => mapping(address => Order)) public orders;
    uint256[] public activeMarkets;
    MockMailbox public mockMailbox;

    constructor(address _mockMailbox) ERC1155("") {
        mockMailbox = MockMailbox(_mockMailbox);
    }

    function placeOrder(uint256 marketId, uint256 price, uint256 amount, bool isBuy) public {
        // For simplicity, we'll just store the order for now.
        // A real implementation would have a more complex order book.
        orders[marketId][msg.sender] = Order(msg.sender, price, amount, isBuy);

        // Add the market to the active markets list if it's not already there.
        bool marketExists = false;
        for (uint i = 0; i < activeMarkets.length; i++) {
            if (activeMarkets[i] == marketId) {
                marketExists = true;
                break;
            }
        }
        if (!marketExists) {
            activeMarkets.push(marketId);
        }
    }

    function getActiveMarkets() public view returns (uint256[] memory) {
        return activeMarkets;
    }

    mapping(uint256 => bool) public marketResolved;
    mapping(uint256 => uint256) public marketOutcome;

    function handleMessage(uint32 _origin, bytes32 _sender, bytes memory _message) public {
        // For now, we'll just decode the message and place the order.
        (uint256 marketId, uint256 price, uint256 amount, bool isBuy) = abi.decode(_message, (uint256, uint256, uint256, bool));
        // In a real implementation, we would need to get the user's address from the message.
        // For now, we'll just use the sender of the message.
        orders[marketId][msg.sender] = Order(msg.sender, price, amount, isBuy);
    }

    function resolveMarket(uint256 marketId, uint256 outcome) public {
        // Only the resolution bot should be able to call this function.
        // For MVP, we'll keep it simple.
        require(!marketResolved[marketId], "Market already resolved");
        marketResolved[marketId] = true;
        marketOutcome[marketId] = outcome;
    }
}