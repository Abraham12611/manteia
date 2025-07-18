#!/usr/bin/env node

const crypto = require('crypto');

console.log('🔐 Generating secure JWT secret for production...\n');

// Generate a cryptographically secure random secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('Generated JWT Secret:');
console.log('===================');
console.log(jwtSecret);
console.log('===================\n');

console.log('📝 Instructions:');
console.log('1. Copy the generated secret above');
console.log('2. Replace "your_jwt_secret_here_replace_with_strong_secret" in vercel-env-vars.txt');
console.log('3. Or set JWT_SECRET directly in Vercel dashboard\n');

console.log('⚠️  Important: Keep this secret secure and never commit it to version control!');
console.log('✅ This secret is suitable for production use.\n');