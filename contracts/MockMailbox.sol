// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockMailbox {
    event Dispatch(uint32 indexed destinationDomain, bytes32 indexed recipientAddress, bytes message);

    function dispatch(uint32 _destinationDomain, bytes32 _recipientAddress, bytes memory _message) public {
        emit Dispatch(_destinationDomain, _recipientAddress, _message);
    }
}
