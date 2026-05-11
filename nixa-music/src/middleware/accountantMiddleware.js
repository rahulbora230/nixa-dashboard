const pool = require("../config/db");

// Check if user has accountant permissions
const isAccountant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  // Accountants can access finance pages
  if (req.user.role === 'admin' || req.user.role === 'accountant') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Accountant access required"
  });
};

// Check if user can upload revenue (admin or accountant with permission)
const canUploadRevenue = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  // Admin can always upload
  if (req.user.role === 'admin') {
    return next();
  }

  // Accountant can upload if allowed
  if (req.user.role === 'accountant') {
    // Check if accountant has upload permission (you could add this to user table)
    // For now, allow all accountants to upload
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Revenue upload permission required"
  });
};

// Check if user can manage payouts (admin or accountant with permission)
const canManagePayouts = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  // Admin can always manage payouts
  if (req.user.role === 'admin') {
    return next();
  }

  // Accountant can manage payouts if allowed
  if (req.user.role === 'accountant') {
    // Check if accountant has payout permission (you could add this to user table)
    // For now, allow all accountants to manage payouts
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Payout management permission required"
  });
};

// Accountant cannot access certain routes
const restrictAccountantAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  // Accountants cannot edit metadata, delete releases, change ownership, change user roles
  if (req.user.role === 'accountant') {
    const restrictedPaths = [
      '/api/releases',
      '/api/metadata-formats',
      '/api/users',
      '/api/artists',
      '/api/labels'
    ];

    const isRestricted = restrictedPaths.some(path => 
      req.path.startsWith(path) && 
      (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH')
    );

    if (isRestricted) {
      return res.status(403).json({
        success: false,
        message: "Accountants cannot access this resource"
      });
    }
  }

  return next();
};

module.exports = {
  isAccountant,
  canUploadRevenue,
  canManagePayouts,
  restrictAccountantAccess
};
