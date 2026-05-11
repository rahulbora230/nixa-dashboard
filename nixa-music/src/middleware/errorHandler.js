// Global error handler for consistent API responses
const errorHandler = (err, req, res, next) => {
  let error = {
    success: false,
    message: 'Internal server error',
    error: 'INTERNAL_ERROR'
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors,
      error: 'VALIDATION_ERROR'
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Access denied',
      error: 'UNAUTHORIZED'
    });
  }

  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      error: 'INSUFFICIENT_PERMISSIONS'
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
      error: 'NOT_FOUND'
    });
  }

  if (err.name === 'ConflictError') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      error: 'CONFLICT'
    });
  }

  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      error: 'DUPLICATE_ENTRY'
    });
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      message: 'Referenced resource does not exist',
      error: 'FOREIGN_KEY_VIOLATION'
    });
  }

  // File upload errors
  if (err.code === 'FILE_TOO_LARGE') {
    return res.status(413).json({
      success: false,
      message: 'File size exceeds maximum allowed size',
      error: 'FILE_TOO_LARGE'
    });
  }

  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only CSV and Excel files are allowed',
      error: 'INVALID_FILE_TYPE'
    });
  }

  // JWT errors
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired',
      error: 'TOKEN_EXPIRED',
      expiredAt: err.expiredAt
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN'
    });
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed',
      error: 'DATABASE_ERROR'
    });
  }

  // Log error for debugging
  console.error('API Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    user: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Default error
  const statusCode = error.statusCode || 500;
  error.message = err.message || 'Internal server error';

  res.status(statusCode).json(error);
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    error: 'NOT_FOUND',
    path: req.path
  });
};

// Health check endpoint
const healthCheck = async (req, res) => {
  try {
    const pool = require('../config/db');
    
    // Check database connection
    const dbCheck = await pool.query('SELECT 1');
    
    res.json({
      success: true,
      message: 'API is healthy',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'API is unhealthy',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message
      }
    });
  }
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
