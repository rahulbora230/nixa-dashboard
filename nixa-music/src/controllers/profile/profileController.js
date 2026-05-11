const managementService = require("../../services/management/managementService");

const getMyProfile = async (req, res) => {
  try {
    const profile = await managementService.getMyProfile(req.user);
    return res.json(profile);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load profile." });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const profile = await managementService.updateMyProfile({ payload: req.body, user: req.user });
    return res.json({ message: "Profile updated successfully.", ...profile });
  } catch (error) {
    const status = error.statusCode || (error.message?.includes("required") || error.message?.includes("Invalid") ? 400 : 500);
    return res.status(status).json({ message: error.message || "Unable to update profile." });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
};
