const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const notificationService = require("../../services/notifications/notificationService");

const listNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.listNotifications({ user: req.user, query: req.query });
  return sendSuccess(res, { message: "Notifications loaded.", data });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationRead({ id: req.params.id, user: req.user });

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found.", errors: [] });
  }

  return sendSuccess(res, { message: "Notification marked read.", data: { notification } });
});

const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllNotificationsRead({ user: req.user });
  return sendSuccess(res, { message: "All notifications marked read.", data });
});

module.exports = {
  listNotifications,
  markAllRead,
  markRead,
};
