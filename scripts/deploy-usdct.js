const hre = require("hardhat");

async function main() {
  const USDCT = await hre.ethers.getContractFactory("USDCT");
  const usdct = await USDCT.deploy();

  await usdct.waitForDeployment();

  console.log("USDCT deployed to:", usdct.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
