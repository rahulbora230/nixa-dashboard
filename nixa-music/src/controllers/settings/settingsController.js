const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/apiResponse");
const settingsService = require("../../services/settings/settingsService");

const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.listSettings();
  return sendSuccess(res, { message: "Settings loaded.", data });
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updateSettings({ payload: req.body, user: req.user });
  return sendSuccess(res, { message: "Settings updated.", data });
});

module.exports = {
  getSettings,
  updateSettings,
};
