#!/usr/bin/env node

/**
 * Verify Manteia Environment Configuration
 *
 * This script checks if all required environment variables are properly set
 * and tests connectivity to external services.
 */

const fs = require('fs');
const path = require('path');

// Required environment variables
const REQUIRED_VARS = [
  'ONEINCH_API_KEY',
  'SUI_RPC_URL',
  'SUI_PRIVATE_KEY',
  'SUI_PACKAGE_ID',
  'SUI_RESOLVER_REGISTRY_ID',
  'ETH_RPC_URL',
  'RESOLVER_PRIVATE_KEY',
  'RESOLVER_SUI_PRIVATE_KEY_BASE64'
];

// Optional but recommended variables
const OPTIONAL_VARS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'RESOLVER_BOT_ENABLED'
];

async function verifyEnvironment() {
  console.log('🔍 Verifying Manteia Environment Configuration...\n');

  // Load environment variables
  const envPath = path.join(__dirname, '../backend/.env');

  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found at:', envPath);
    console.log('   Please create it from env.template');
    process.exit(1);
  }

  // Parse .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=');
      }
    }
  });

  let hasErrors = false;

  // Check required variables
  console.log('📋 Required Environment Variables:');
  console.log('================================');

  for (const varName of REQUIRED_VARS) {
    const value = envVars[varName];
    const status = value && value !== 'your_..._here' ? '✅' : '❌';
    const displayValue = value ?
      (value.length > 20 ? value.substring(0, 17) + '...' : value) :
      'MISSING';

    console.log(`${status} ${varName.padEnd(30)} ${displayValue}`);

    if (!value || value === 'your_..._here' || value.includes('your_')) {
      hasErrors = true;
    }
  }

  console.log('\n📝 Optional Environment Variables:');
  console.log('=================================');

  for (const varName of OPTIONAL_VARS) {
    const value = envVars[varName];
    const status = value ? '✅' : '⚠️ ';
    const displayValue = value || 'NOT SET';

    console.log(`${status} ${varName.padEnd(30)} ${displayValue}`);
  }

  // Validate specific formats
  console.log('\n🔍 Format Validation:');
  console.log('====================');

  // Check Sui private key format
  const suiKey = envVars['SUI_PRIVATE_KEY'];
  if (suiKey && suiKey.startsWith('suiprivkey')) {
    console.log('✅ SUI_PRIVATE_KEY format is valid');
  } else {
    console.log('❌ SUI_PRIVATE_KEY should start with "suiprivkey"');
    hasErrors = true;
  }

  // Check Ethereum private key format
  const ethKey = envVars['RESOLVER_PRIVATE_KEY'];
  if (ethKey && ethKey.startsWith('0x') && ethKey.length === 66) {
    console.log('✅ RESOLVER_PRIVATE_KEY format is valid');
  } else {
    console.log('❌ RESOLVER_PRIVATE_KEY should be 64-char hex string starting with 0x');
    hasErrors = true;
  }

  // Check object ID formats
  const packageId = envVars['SUI_PACKAGE_ID'];
  if (packageId && packageId.startsWith('0x')) {
    console.log('✅ SUI_PACKAGE_ID format is valid');
  } else {
    console.log('❌ SUI_PACKAGE_ID should start with "0x"');
    hasErrors = true;
  }

  const registryId = envVars['SUI_RESOLVER_REGISTRY_ID'];
  if (registryId && registryId.startsWith('0x')) {
    console.log('✅ SUI_RESOLVER_REGISTRY_ID format is valid');
  } else {
    console.log('❌ SUI_RESOLVER_REGISTRY_ID should start with "0x"');
    hasErrors = true;
  }

  // Test connectivity
  console.log('\n🌐 Connectivity Tests:');
  console.log('=====================');

  try {
    // Test Sui RPC
    const suiRpc = envVars['SUI_RPC_URL'];
    if (suiRpc) {
      console.log('🔄 Testing Sui RPC connection...');
      const response = await fetch(suiRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sui_getLatestCheckpointSequenceNumber',
          params: []
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Sui RPC connection successful');
        console.log(`   Latest checkpoint: ${data.result}`);
      } else {
        console.log('❌ Sui RPC connection failed');
        hasErrors = true;
      }
    }
  } catch (error) {
    console.log('❌ Sui RPC test failed:', error.message);
    hasErrors = true;
  }

  try {
    // Test Ethereum RPC
    const ethRpc = envVars['ETH_RPC_URL'];
    if (ethRpc) {
      console.log('🔄 Testing Ethereum RPC connection...');
      const response = await fetch(ethRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: []
        })
      });

      if (response.ok) {
        const data = await response.json();
        const blockNumber = parseInt(data.result, 16);
        console.log('✅ Ethereum RPC connection successful');
        console.log(`   Latest block: ${blockNumber}`);
      } else {
        console.log('❌ Ethereum RPC connection failed');
        hasErrors = true;
      }
    }
  } catch (error) {
    console.log('❌ Ethereum RPC test failed:', error.message);
    hasErrors = true;
  }

  try {
    // Test 1inch API
    const apiKey = envVars['ONEINCH_API_KEY'];
    if (apiKey && !apiKey.includes('your_')) {
      console.log('🔄 Testing 1inch API connection...');
      const response = await fetch('https://api.1inch.dev/swap/v5.2/1/tokens', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'accept': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ 1inch API connection successful');
      } else {
        console.log(`❌ 1inch API connection failed (${response.status})`);
        hasErrors = true;
      }
    } else {
      console.log('⏭️  Skipping 1inch API test (no valid API key)');
    }
  } catch (error) {
    console.log('❌ 1inch API test failed:', error.message);
    hasErrors = true;
  }

  // Summary
  console.log('\n📊 Verification Summary:');
  console.log('========================');

  if (hasErrors) {
    console.log('❌ Environment verification FAILED');
    console.log('   Please fix the issues above before proceeding.');
    console.log('\n🔧 How to fix:');
    console.log('   1. Run: ./scripts/setup-environment.sh');
    console.log('   2. Get 1inch API key: https://portal.1inch.dev/');
    console.log('   3. Deploy contracts: ./scripts/deploy-sui-contracts.sh');
    process.exit(1);
  } else {
    console.log('✅ Environment verification PASSED');
    console.log('   Your Manteia development environment is ready!');
    console.log('\n🚀 Next steps:');
    console.log('   cd backend && npm run dev');
  }
}

// Run the verification
verifyEnvironment().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});