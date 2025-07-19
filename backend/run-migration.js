#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  console.log('🚀 Starting database migration...');

  // Create database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_create_users_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📜 Running migration: 001_create_users_table.sql');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Database schema created with the following tables:');
    console.log('   - users (profile data)');
    console.log('   - positions (trading positions)');
    console.log('   - user_activities (activity log)');
    console.log('   - transactions (transaction history)');
    console.log('   - transaction_receipts (receipts)');
    console.log('   - cross_chain_bridges (bridge transactions)');
    console.log('');
    console.log('🧪 Sample user created for testing:');
    console.log('   Wallet: 0x733b34e60D3eEa70609364968566f13405802062');
    console.log('   Username: Test User');
    console.log('');
    console.log('🎉 You can now test the profile page!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration().catch(console.error);