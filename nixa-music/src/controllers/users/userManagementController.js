const managementService = require("../../services/management/managementService");

const sendError = (res, error, fallback = "Request failed.") => {
  const status = error.statusCode || (error.message?.includes("required") || error.message?.includes("Invalid") ? 400 : 500);
  return res.status(status).json({ message: error.message || fallback });
};

const listUsers = async (req, res) => {
  try {
    const result = await managementService.listUsers({ query: req.query });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Unable to load users.");
  }
};

const getUser = async (req, res) => {
  try {
    const user = await managementService.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user });
  } catch (error) {
    return sendError(res, error, "Unable to load user.");
  }
};

const createUser = async (req, res) => {
  try {
    const result = await managementService.createUser({ payload: req.body, user: req.user });
    return res.status(201).json({ message: "User created successfully.", ...result });
  } catch (error) {
    return sendError(res, error, "Unable to create user.");
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await managementService.updateUser({ id: req.params.id, payload: req.body, user: req.user });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ message: "User updated successfully.", user });
  } catch (error) {
    return sendError(res, error, "Unable to update user.");
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const user = await managementService.updateUserStatus({
      id: req.params.id,
      status: req.body.status,
      user: req.user,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ message: "User status updated.", user });
  } catch (error) {
    return sendError(res, error, "Unable to update user status.");
  }
};

const resetPassword = async (req, res) => {
  try {
    const result = await managementService.resetUserPassword({
      id: req.params.id,
      payload: req.body,
      user: req.user,
    });

    if (!result) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ message: "Password reset successfully.", ...result });
  } catch (error) {
    return sendError(res, error, "Unable to reset password.");
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await managementService.deleteUser({ id: req.params.id, user: req.user });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ message: "User disabled successfully.", user });
  } catch (error) {
    return sendError(res, error, "Unable to disable user.");
  }
};

module.exports = {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  resetPassword,
  updateUser,
  updateUserStatus,
};
