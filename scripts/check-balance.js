
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer Address:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
