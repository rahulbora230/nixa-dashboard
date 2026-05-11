const { validatePassword } = require('./securityMiddleware');

// Input validation schemas
const schemas = {
  auth: {
    login: {
      email: {
        required: true,
        type: 'email',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },
      password: {
        required: true,
        minLength: 8,
        maxLength: 128
      }
    },
    register: {
      name: {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z\s]+$/
      },
      email: {
        required: true,
        type: 'email',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },
      password: {
        required: true,
        minLength: 8,
        maxLength: 128
      },
      role: {
        required: true,
        enum: ['admin', 'artist', 'label', 'accountant']
      }
    },
    release: {
      title: {
        required: true,
        minLength: 1,
        maxLength: 200
      },
      artist_name: {
        required: true,
        minLength: 1,
        maxLength: 100
      },
      release_date: {
        required: true,
        type: 'date',
        pattern: /^\d{4}-\d{2}-\d{2}$/
      },
      genre: {
        required: true,
        maxLength: 50
      },
      tracks: {
        required: true,
        type: 'array',
        minItems: 1,
        maxItems: 50
      }
    },
    revenue: {
      upload: {
        file: {
          required: true,
          type: 'file'
        },
        report_month: {
          required: true,
          pattern: /^\d{4}-\d{2}$/
        }
      },
      payout: {
        amount: {
          required: true,
          type: 'number',
          min: 0.01,
          max: 999999.99
        },
        user_id: {
          required: true,
          type: 'uuid'
        },
        artist_id: {
          required: true,
          type: 'uuid'
        }
      }
    }
  };

// Validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = {};
    const data = req.body;

    const validateField = (field, rules, value) => {
      const fieldErrors = [];

      // Required validation
      if (rules.required && (!value || value === '' || value === null || value === undefined)) {
        fieldErrors.push(`${field} is required`);
      }

      // Type validation
      if (rules.type && value !== undefined && value !== null) {
        if (rules.type === 'email') {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(value)) {
            fieldErrors.push(`${field} must be a valid email`);
          }
        } else if (rules.type === 'date') {
          const datePattern = /^\d{4}-\d{2}-\d{2}$/;
          if (!datePattern.test(value)) {
            fieldErrors.push(`${field} must be in YYYY-MM-DD format`);
          }
        } else if (rules.type === 'uuid') {
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidPattern.test(value)) {
            fieldErrors.push(`${field} must be a valid UUID`);
          }
        }
      }

      // Length validation
      if (rules.minLength && value && value.length < rules.minLength) {
        fieldErrors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && value && value.length > rules.maxLength) {
        fieldErrors.push(`${field} must not exceed ${rules.maxLength} characters`);
      }

      // Pattern validation
      if (rules.pattern && value && !rules.pattern.test(value)) {
        fieldErrors.push(`${field} format is invalid`);
      }

      // Enum validation
      if (rules.enum && value && !rules.enum.includes(value)) {
        fieldErrors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }

      // Number validation
      if (rules.min !== undefined && value !== undefined && value < rules.min) {
        fieldErrors.push(`${field} must be at least ${rules.min}`);
      }

      if (rules.max !== undefined && value !== undefined && value > rules.max) {
        fieldErrors.push(`${field} must not exceed ${rules.max}`);
      }

      // Array validation
      if (rules.type === 'array' && value !== undefined) {
        if (rules.minItems && value.length < rules.minItems) {
          fieldErrors.push(`${field} must have at least ${rules.minItems} items`);
        }

        if (rules.maxItems && value.length > rules.maxItems) {
          fieldErrors.push(`${field} must not exceed ${rules.maxItems} items`);
        }
      }

      return fieldErrors;
    };

    // Validate all fields in schema
    for (const field in schema) {
      const fieldErrors = validateField(field, schema[field], data[field]);
      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      }
    }

    // Password strength validation
    if (schema.auth?.login?.password && data.password) {
      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.isValid) {
        errors.password = passwordValidation.feedback;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
        error: 'VALIDATION_ERROR'
      });
    }

    // Sanitize input data
    req.validatedData = data;
    next();
  };
};

// Specific validation middleware functions
const validateAuth = validateRequest(schemas.auth);
const validateRelease = validateRequest(schemas.release);
const validateRevenue = validateRequest(schemas.revenue);

module.exports = {
  validateAuth,
  validateRelease,
  validateRevenue,
  schemas
};
