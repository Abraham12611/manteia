// Vercel Serverless Function Entry Point
// This file routes all API requests to the backend Express server

const path = require('path');

// Import the backend server
const ManteiaBackend = require('../backend/server.js');

// Create a serverless handler
let backend = null;

const handler = async (req, res) => {
  try {
    // Initialize backend if not already done
    if (!backend) {
      backend = new ManteiaBackend();
      await backend.initialize();
    }

    // Handle the request using the Express app
    return backend.app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export for Vercel
module.exports = handler;