require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// For secure configuration variables (recommended by Hardhat)
const { vars } = require("hardhat/config");

// Get configuration variables (fallback to .env for local development)
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || vars.get("ALCHEMY_API_KEY", "");
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || vars.get("SEPOLIA_PRIVATE_KEY", "");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : "https://rpc.sepolia.org",
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 20000000000, // 20 gwei
      gas: 6000000,
    },
    mainnet: {
      url: process.env.ETHEREUM_MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};