import { randomUUID } from 'crypto';

export function requestLogger(logger) {
  return (req, res, next) => {
    // Generate unique request ID
    req.id = randomUUID();

    // Start timer
    const startTime = process.hrtime.bigint();

    // Add request ID to response headers
    res.set('X-Request-ID', req.id);

    // Log request start
    const requestInfo = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: getClientIP(req),
      query: req.query,
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      referer: req.get('Referer'),
      timestamp: new Date().toISOString()
    };

    // Don't log sensitive data in body
    if (req.body && Object.keys(req.body).length > 0) {
      requestInfo.bodyKeys = Object.keys(req.body);
      requestInfo.bodySize = JSON.stringify(req.body).length;
    }

    logger.info('Request started', requestInfo);

    // Capture original res.end to log response
    const originalEnd = res.end;

    res.end = function(chunk, encoding) {
      // Calculate response time
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Log response
      const responseInfo = {
        requestId: req.id,
        statusCode: res.statusCode,
        responseTime: `${responseTime.toFixed(2)}ms`,
        contentLength: res.get('Content-Length'),
        contentType: res.get('Content-Type'),
        timestamp: new Date().toISOString()
      };

      // Add response size if we have the chunk
      if (chunk) {
        responseInfo.responseSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      }

      // Determine log level based on status code
      if (res.statusCode >= 500) {
        logger.error('Request completed with server error', responseInfo);
      } else if (res.statusCode >= 400) {
        logger.warn('Request completed with client error', responseInfo);
      } else {
        logger.info('Request completed successfully', responseInfo);
      }

      // Call original end
      originalEnd.call(this, chunk, encoding);
    };

    // Handle errors
    res.on('error', (error) => {
      logger.error('Response error', {
        requestId: req.id,
        error: error.message,
        stack: error.stack
      });
    });

    next();
  };
}

// Helper function to get real client IP
function getClientIP(req) {
  return req.ip ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.headers['x-client-ip'] ||
         'unknown';
}

// Middleware to skip logging for certain routes (like health checks)
export function skipLogging(paths = []) {
  return (req, res, next) => {
    const shouldSkip = paths.some(path => {
      if (typeof path === 'string') {
        return req.url === path;
      } else if (path instanceof RegExp) {
        return path.test(req.url);
      }
      return false;
    });

    if (shouldSkip) {
      return next();
    }

    return requestLogger(req.logger || console)(req, res, next);
  };
}

// Middleware to redact sensitive fields from logs
export function redactSensitiveData(sensitiveFields = ['password', 'token', 'secret', 'key', 'privateKey']) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = redactObject(req.body, sensitiveFields);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = redactObject(req.query, sensitiveFields);
    }

    next();
  };
}

// Helper function to redact sensitive fields from objects
function redactObject(obj, sensitiveFields) {
  const redacted = { ...obj };

  for (const field of sensitiveFields) {
    if (redacted[field] !== undefined) {
      redacted[field] = '[REDACTED]';
    }
  }

  return redacted;
}

// Performance monitoring middleware
export function performanceMonitor(logger) {
  const requestCounts = new Map();
  const responseTimes = new Map();

  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const route = `${req.method} ${req.route?.path || req.url}`;

    // Track request count
    requestCounts.set(route, (requestCounts.get(route) || 0) + 1);

    // Capture original end
    const originalEnd = res.end;

    res.end = function(chunk, encoding) {
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1000000;

      // Track response time
      if (!responseTimes.has(route)) {
        responseTimes.set(route, []);
      }
      responseTimes.get(route).push(responseTime);

      // Log slow requests (> 1 second)
      if (responseTime > 1000) {
        logger.warn('Slow request detected', {
          route,
          responseTime: `${responseTime.toFixed(2)}ms`,
          statusCode: res.statusCode
        });
      }

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

// Get performance stats
export function getPerformanceStats() {
  const stats = {};

  for (const [route, times] of responseTimes.entries()) {
    const sortedTimes = times.sort((a, b) => a - b);
    const count = times.length;

    stats[route] = {
      requestCount: requestCounts.get(route) || 0,
      avgResponseTime: times.reduce((a, b) => a + b, 0) / count,
      minResponseTime: sortedTimes[0],
      maxResponseTime: sortedTimes[count - 1],
      p50: sortedTimes[Math.floor(count * 0.5)],
      p95: sortedTimes[Math.floor(count * 0.95)],
      p99: sortedTimes[Math.floor(count * 0.99)]
    };
  }

  return stats;
}