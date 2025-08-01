const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Network-specific configurations
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Deploying to network:", network.name, "Chain ID:", chainId);

  let wormholeTokenBridge, usdcToken;

  if (chainId === 11155111n) { // Sepolia
    wormholeTokenBridge = "0xDB5492265f6038831E89f495670FF909aDe94bd9";
    usdcToken = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // USDC on Sepolia
  } else if (chainId === 1n) { // Mainnet
    wormholeTokenBridge = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585";
    usdcToken = "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // USDC on Mainnet
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  console.log("Using Wormhole TokenBridge:", wormholeTokenBridge);
  console.log("Using USDC Token:", usdcToken);

  // Deploy BridgeAdapter
  console.log("\nDeploying BridgeAdapter...");
  const BridgeAdapter = await ethers.getContractFactory("BridgeAdapter");
  const bridgeAdapter = await BridgeAdapter.deploy(wormholeTokenBridge, usdcToken);

  await bridgeAdapter.waitForDeployment();
  const bridgeAdapterAddress = await bridgeAdapter.getAddress();

  console.log("BridgeAdapter deployed to:", bridgeAdapterAddress);

  // Deploy SwapCoordinator
  console.log("\nDeploying SwapCoordinator...");
  const SwapCoordinator = await ethers.getContractFactory("SwapCoordinator");
  const swapCoordinator = await SwapCoordinator.deploy(
    bridgeAdapterAddress,
    deployer.address // Fee collector (deployer for now)
  );

  await swapCoordinator.waitForDeployment();
  const swapCoordinatorAddress = await swapCoordinator.getAddress();

  console.log("SwapCoordinator deployed to:", swapCoordinatorAddress);

  // Verify contracts on Etherscan (if not local network)
  if (chainId !== 31337n) {
    console.log("\nWaiting for block confirmations...");
    await bridgeAdapter.deploymentTransaction().wait(5);
    await swapCoordinator.deploymentTransaction().wait(5);

    console.log("\nVerifying contracts on Etherscan...");

    try {
      await hre.run("verify:verify", {
        address: bridgeAdapterAddress,
        constructorArguments: [wormholeTokenBridge, usdcToken],
      });
      console.log("BridgeAdapter verified on Etherscan");
    } catch (error) {
      console.log("BridgeAdapter verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: swapCoordinatorAddress,
        constructorArguments: [bridgeAdapterAddress, deployer.address],
      });
      console.log("SwapCoordinator verified on Etherscan");
    } catch (error) {
      console.log("SwapCoordinator verification failed:", error.message);
    }
  }

  // Output deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", network.name);
  console.log("Chain ID:", chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("BridgeAdapter:", bridgeAdapterAddress);
  console.log("SwapCoordinator:", swapCoordinatorAddress);
  console.log("Wormhole TokenBridge:", wormholeTokenBridge);
  console.log("USDC Token:", usdcToken);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: chainId.toString(),
    deployer: deployer.address,
    contracts: {
      BridgeAdapter: bridgeAdapterAddress,
      SwapCoordinator: swapCoordinatorAddress
    },
    dependencies: {
      WormholeTokenBridge: wormholeTokenBridge,
      USDCToken: usdcToken
    },
    deployedAt: new Date().toISOString()
  };

  // Write deployment info to file
  const fs = require('fs');
  const deploymentFile = `deployment-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });