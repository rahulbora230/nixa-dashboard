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

      return callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
  };
};

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    }
  });
  next();
};

const applySecurityMiddleware = (app) => {
  const helmet = optionalRequire("helmet");
  const rateLimit = optionalRequire("express-rate-limit");
  const morgan = optionalRequire("morgan");

  if (helmet) {
    app.use(helmet());
  } else {
    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      next();
    });
  }

  app.use(cors(buildCorsOptions()));

  if (rateLimit) {
    app.use(
      "/api",
      rateLimit({
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
        max: Number(process.env.RATE_LIMIT_MAX || 600),
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
  }

  app.use(morgan ? morgan(process.env.NODE_ENV === "production" ? "combined" : "dev") : requestLogger);
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
