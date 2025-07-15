// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./MockMailbox.sol";

contract MarketSpoke {
    using Address for address;

    uint32 public mantleDomain;
    address public marketHub;
    MockMailbox public mockMailbox;

    constructor(address _mockMailbox, uint32 _mantleDomain, address _marketHub) {
        mockMailbox = MockMailbox(_mockMailbox);
        mantleDomain = _mantleDomain;
        marketHub = _marketHub;
    }

    function placeOrder(uint256 marketId, uint256 price, uint256 amount, bool isBuy) public {
        bytes memory message = abi.encode(marketId, price, amount, isBuy);
        mockMailbox.dispatch(mantleDomain, addressToBytes32(marketHub), message);
    }

    function _handle(uint32 _origin, bytes32 _sender, bytes memory _message) internal {
        // For now, we'll just emit an event with the message.
        emit ReceivedMessage(_origin, _sender, _message);
    }

    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    event ReceivedMessage(uint32 origin, bytes32 sender, bytes message);
}