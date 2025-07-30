export function errorHandler(logger) {
  return (err, req, res, next) => {
    // Log the error
    logger.error('Request error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // Default error
    let status = 500;
    let message = 'Internal Server Error';
    let details = null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
      status = 400;
      message = 'Validation Error';
      details = isDevelopment ? err.details : null;
    } else if (err.name === 'UnauthorizedError') {
      status = 401;
      message = 'Unauthorized';
    } else if (err.name === 'ForbiddenError') {
      status = 403;
      message = 'Forbidden';
    } else if (err.name === 'NotFoundError') {
      status = 404;
      message = 'Not Found';
    } else if (err.name === 'ConflictError') {
      status = 409;
      message = 'Conflict';
    } else if (err.name === 'TooManyRequestsError') {
      status = 429;
      message = 'Too Many Requests';
    } else if (err.status) {
      status = err.status;
      message = err.message;
    } else if (isDevelopment) {
      message = err.message;
      details = err.stack;
    }

    // Send error response
    const errorResponse = {
      error: {
        message,
        status,
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown'
      }
    };

    if (details && isDevelopment) {
      errorResponse.error.details = details;
    }

    res.status(status).json(errorResponse);
  };
}