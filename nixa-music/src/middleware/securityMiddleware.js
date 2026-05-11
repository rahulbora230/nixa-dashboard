const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

// Rate limiting store (in production, use Redis)
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60) // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent XSS
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'"
  );
  
  next();
};

// File upload validation middleware
const validateFileUpload = (req, res, next) => {
  const allowedMimeTypes = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  if (req.file && req.file.size > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'File size exceeds maximum allowed size of 50MB',
      error: 'FILE_TOO_LARGE'
    });
  }
  
  if (req.file && !allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only CSV and Excel files are allowed.',
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  // Sanitize filename to prevent path traversal
  if (req.file && req.file.originalname) {
    const sanitized = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '')
      .replace(/\.\./g, '');
    
    req.file.originalname = sanitized;
  }
  
  next();
};

// Input validation middleware
const validateInput = (req, res, next) => {
  // Basic XSS prevention
  const sanitizeInput = (obj) => {
    if (typeof obj !== 'object') return obj;
    
    const sanitized = {};
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        sanitized[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*<\/script>/gi, '')
          .replace(/<script[^>]*>.*?<\/script>/gi, '');
      } else {
        sanitized[key] = obj[key];
      }
    }
    return sanitized;
  };
  
  req.sanitizedBody = sanitizeInput(req.body);
  next();
};

// Password strength validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const score = [
    password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar
  ].filter(Boolean).length;
  
  return {
    isValid: score >= 3,
    score,
    feedback: {
      length: password.length >= minLength,
      uppercase: hasUpperCase,
      lowercase: hasLowerCase,
      numbers: hasNumbers,
      special: hasSpecialChar
    }
  };
};

module.exports = {
  rateLimiter,
  securityHeaders,
  validateFileUpload,
  validateInput,
  validatePassword
};
