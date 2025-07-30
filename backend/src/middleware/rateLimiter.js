import { RateLimiterMemory } from 'rate-limiter-flexible';

// Create different rate limiters for different endpoints
const generalLimiter = new RateLimiterMemory({
  keyspace: 'general',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if limit exceeded
});

const swapLimiter = new RateLimiterMemory({
  keyspace: 'swap',
  points: 10, // Number of swap requests
  duration: 60, // Per 60 seconds
  blockDuration: 300, // Block for 5 minutes if limit exceeded
});

const quoteLimiter = new RateLimiterMemory({
  keyspace: 'quote',
  points: 50, // Number of quote requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if limit exceeded
});

// Helper function to get client identifier
function getClientId(req) {
  // Try to get user ID from auth, otherwise use IP
  return req.user?.id || req.ip || 'unknown';
}

// General rate limiter middleware
export const rateLimiter = async (req, res, next) => {
  const clientId = getClientId(req);

  try {
    await generalLimiter.consume(clientId);
    next();
  } catch (rejRes) {
    const totalHits = rejRes.totalHits;
    const remainingPoints = rejRes.remainingPoints;
    const msBeforeNext = rejRes.msBeforeNext;

    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000) || 1,
      'X-RateLimit-Limit': generalLimiter.points,
      'X-RateLimit-Remaining': remainingPoints < 0 ? 0 : remainingPoints,
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString()
    });

    res.status(429).json({
      error: {
        message: 'Too Many Requests',
        status: 429,
        retryAfter: Math.round(msBeforeNext / 1000),
        limit: generalLimiter.points,
        remaining: remainingPoints < 0 ? 0 : remainingPoints
      }
    });
  }
};

// Swap-specific rate limiter
export const swapRateLimiter = async (req, res, next) => {
  const clientId = getClientId(req);

  try {
    await swapLimiter.consume(clientId);
    next();
  } catch (rejRes) {
    const msBeforeNext = rejRes.msBeforeNext;

    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000) || 1,
      'X-RateLimit-Limit': swapLimiter.points,
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString()
    });

    res.status(429).json({
      error: {
        message: 'Too many swap requests. Please try again later.',
        status: 429,
        retryAfter: Math.round(msBeforeNext / 1000),
        limit: swapLimiter.points
      }
    });
  }
};

// Quote-specific rate limiter
export const quoteRateLimiter = async (req, res, next) => {
  const clientId = getClientId(req);

  try {
    await quoteLimiter.consume(clientId);
    next();
  } catch (rejRes) {
    const msBeforeNext = rejRes.msBeforeNext;

    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000) || 1,
      'X-RateLimit-Limit': quoteLimiter.points,
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString()
    });

    res.status(429).json({
      error: {
        message: 'Too many quote requests. Please try again later.',
        status: 429,
        retryAfter: Math.round(msBeforeNext / 1000),
        limit: quoteLimiter.points
      }
    });
  }
};

// Create custom rate limiter
export function createRateLimiter(options) {
  const limiter = new RateLimiterMemory({
    keyspace: options.keyspace || 'custom',
    points: options.points || 100,
    duration: options.duration || 60,
    blockDuration: options.blockDuration || 60,
  });

  return async (req, res, next) => {
    const clientId = getClientId(req);

    try {
      await limiter.consume(clientId);
      next();
    } catch (rejRes) {
      const msBeforeNext = rejRes.msBeforeNext;

      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString()
      });

      res.status(429).json({
        error: {
          message: options.message || 'Too Many Requests',
          status: 429,
          retryAfter: Math.round(msBeforeNext / 1000),
          limit: limiter.points
        }
      });
    }
  };
}