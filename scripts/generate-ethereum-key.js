#!/usr/bin/env node

/**
 * Generate Ethereum Private Key for Manteia Resolver
 *
 * This script generates a new Ethereum keypair for use as a resolver
 * in the Manteia cross-chain DEX system.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating Ethereum Resolver Keypair...\n');

try {
  // Generate a random wallet
  const wallet = ethers.Wallet.createRandom();

  // Display the results
  console.log('╭─────────────────────────────────────────────────────╮');
  console.log('│              Ethereum Resolver Keypair             │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log(`│ Address:     ${wallet.address}  │`);
  console.log(`│ Private Key: ${wallet.privateKey} │`);
  console.log('╰─────────────────────────────────────────────────────╯');

  console.log('\n📝 Environment Variables:');
  console.log('RESOLVER_PRIVATE_KEY=' + wallet.privateKey);
  console.log('RESOLVER_ETHEREUM_ADDRESS=' + wallet.address);

  console.log('\n🎯 Next Steps:');
  console.log('1. Add RESOLVER_PRIVATE_KEY to your .env file');
  console.log('2. Get Sepolia testnet ETH: https://sepoliafaucet.com/');
  console.log('3. Fund this address with test ETH for gas fees');

  console.log('\n⚠️  Security Warning:');
  console.log('• This is for TESTNET use only');
  console.log('• Never share your private key');
  console.log('• Do not use this key on mainnet');

  // Optionally save to a file
  const envEntry = `\n# Ethereum Resolver Configuration (Generated ${new Date().toISOString()})\nRESOLVER_PRIVATE_KEY=${wallet.privateKey}\nRESOLVER_ETHEREUM_ADDRESS=${wallet.address}\n`;

  const envPath = path.join(__dirname, '../backend/.env.new');
  fs.appendFileSync(envPath, envEntry);
  console.log(`\n💾 Also saved to: ${envPath}`);

} catch (error) {
  console.error('❌ Error generating keypair:', error);
  process.exit(1);
}