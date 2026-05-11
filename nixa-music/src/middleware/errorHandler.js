const { sendError } = require("../utils/apiResponse");

const notFoundHandler = (req, res) =>
  sendError(res, {
    status: 404,
    message: `Route not found: ${req.originalUrl}`,
  });

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    console.error("Server Error:", err);
  }

  return sendError(res, {
    status,
    message: status >= 500 && isProduction ? "Internal Server Error" : err.message || "Internal Server Error",
    errors: err.errors || [],
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
