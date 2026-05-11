const express = require("express");
const router = express.Router();

const {
  loginUser,
} = require("../controllers/userController");
const {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  resetPassword,
  updateUser,
  updateUserStatus,
} = require("../controllers/users/userManagementController");

const { verifyToken, onlyAdmin } = require("../middleware/authMiddleware");

router.post("/login", loginUser);

router.post("/create", verifyToken, onlyAdmin, createUser);

router.get("/", verifyToken, onlyAdmin, listUsers);
router.get("/:id", verifyToken, onlyAdmin, getUser);
router.post("/", verifyToken, onlyAdmin, createUser);
router.put("/:id", verifyToken, onlyAdmin, updateUser);
router.patch("/:id/status", verifyToken, onlyAdmin, updateUserStatus);
router.patch("/:id/reset-password", verifyToken, onlyAdmin, resetPassword);
router.delete("/:id", verifyToken, onlyAdmin, deleteUser);

module.exports = router;
