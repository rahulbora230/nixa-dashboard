const jwt = require("jsonwebtoken");

// Remove fallback secret - require from environment
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        message: "Authentication required",
        error: "NO_TOKEN" 
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token format",
        error: "INVALID_FORMAT" 
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Token is missing",
        error: "MISSING_TOKEN" 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: "Token has expired",
        error: "TOKEN_EXPIRED" 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: "Invalid or expired token",
      error: "INVALID_TOKEN" 
    });
  }
};

const onlyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ 
      success: false,
      message: "Admin access required",
      error: "INSUFFICIENT_PERMISSIONS" 
    });
  }

  next();
};

module.exports = {
  verifyToken,
  onlyAdmin,
};