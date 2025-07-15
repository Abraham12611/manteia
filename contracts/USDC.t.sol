// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDCT is ERC20 {
    constructor() ERC20("USDCT", "USDC.t") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }
}
