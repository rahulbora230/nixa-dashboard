const sendSuccess = (res, { status = 200, message = "Action completed", data = {}, meta = undefined } = {}) =>
  res.status(status).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });

const sendError = (res, { status = 500, message = "Internal Server Error", errors = [] } = {}) =>
  res.status(status).json({
    success: false,
    message,
    errors,
  });

module.exports = {
  sendError,
  sendSuccess,
};
