const cors = require("cors");

const optionalRequire = (packageName) => {
  try {
    return require(packageName);
  } catch {
    return null;
  }
};

const buildCorsOptions = () => {
  const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  };
};

const applySecurityMiddleware = (app) => {
  const corsOptions = buildCorsOptions();
  const helmet = optionalRequire("helmet");
  const rateLimit = optionalRequire("express-rate-limit");

  if (helmet) {
    app.use(helmet());
  }

  if (rateLimit) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: {
        success: false,
        message: "Too many requests from this IP, please try again later.",
        retryAfter: Math.ceil(15 * 60)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);
  }

  app.use(cors(corsOptions));
};

const validateEnvironment = () => {
  const required = ["JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (missing.length) {
    console.warn(`Using development fallbacks for: ${missing.join(", ")}`);
  }
};

module.exports = {
  applySecurityMiddleware,
  validateEnvironment,
};
