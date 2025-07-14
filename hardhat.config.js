require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    mantle_sepolia: {
      url: "https://rpc.sepolia.mantle.xyz",
      accounts: [process.env.MANTLE_SEPOLIA_PRIVATE_KEY],
    },
    /*base_sepolia: {
      url: "https://sepolia.base.org",
      accounts: [process.env.BASE_SEPOLIA_PRIVATE_KEY],
    },*/
  },
  etherscan: {
    apiKey: {
      mantle_sepolia: process.env.MANTLESCAN_API_KEY,
    },
    customChains: [
      {
        network: "mantle_sepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://api-sepolia.mantlescan.xyz/api",
          browserURL: "https://sepolia.mantlescan.xyz",
        },
      },
    ],
  },
};

console.log("→ MANTLE key:", process.env.MANTLE_SEPOLIA_PRIVATE_KEY);
//console.log("→ BASE   key:", process.env.BASE_SEPOLIA_PRIVATE_KEY);