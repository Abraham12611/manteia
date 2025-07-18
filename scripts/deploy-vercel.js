#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Manteia Vercel Deployment Helper\n');

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'pipe' });
  console.log('✅ Vercel CLI found');
} catch (error) {
  console.log('❌ Vercel CLI not found. Installing...');
  execSync('npm install -g vercel', { stdio: 'inherit' });
}

// Check for required files
const requiredFiles = [
  'vercel.json',
  'frontend/package.json',
  'backend/package.json',
  'api/index.js'
];

console.log('\n📋 Checking required files...');
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing!`);
    process.exit(1);
  }
}

// Check environment variables
console.log('\n⚙️ Environment Variables Needed:');
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REACT_APP_REOWN_PROJECT_ID',
  'REACT_APP_MARKET_HUB_ADDRESS'
];

const optionalEnvVars = [
  'MANTLE_RPC_URL',
  'REACT_APP_BACKEND_URL',
  'REDIS_URL'
];

console.log('\n🔴 Required:');
requiredEnvVars.forEach(envVar => {
  console.log(`   ${envVar}`);
});

console.log('\n🟡 Optional:');
optionalEnvVars.forEach(envVar => {
  console.log(`   ${envVar}`);
});

console.log('\n📝 Set these in Vercel Dashboard → Settings → Environment Variables');

// Build instructions
console.log('\n🔧 Deployment Steps:');
console.log('1. Run: vercel login');
console.log('2. Run: vercel --prod');
console.log('3. Set environment variables in Vercel dashboard');
console.log('4. Redeploy if needed: vercel --prod --force');

console.log('\n🌐 After deployment:');
console.log('• Update REACT_APP_BACKEND_URL with your Vercel URL');
console.log('• Test wallet connection with Mantle Sepolia');
console.log('• Verify API endpoints are working');

console.log('\n✨ Ready to deploy! Run "vercel --prod" to start.\n');