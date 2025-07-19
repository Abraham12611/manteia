const hre = require("hardhat");

async function main() {
  const mantleDomainId = 5003;

  // Deploy MockMailbox
  const MockMailbox = await hre.ethers.getContractFactory("MockMailbox");
  const mockMailbox = await MockMailbox.deploy();
  await mockMailbox.waitForDeployment();
  console.log("MockMailbox deployed to:", mockMailbox.target);

  // Deploy MarketHub on Mantle Sepolia
  const MarketHub = await hre.ethers.getContractFactory("MarketHub");
  const marketHub = await MarketHub.deploy(); // Remove parameter as constructor doesn't take any
  await marketHub.waitForDeployment();
  console.log("MarketHub deployed to:", marketHub.target, "on Mantle Sepolia");

  // Deploy MarketSpoke on Base Sepolia
  const MarketSpoke = await hre.ethers.getContractFactory("MarketSpoke");
  const marketSpoke = await MarketSpoke.deploy(mockMailbox.target, mantleDomainId, marketHub.target);
  await marketSpoke.waitForDeployment();
  console.log("MarketSpoke deployed to:", marketSpoke.target, "on Base Sepolia");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});