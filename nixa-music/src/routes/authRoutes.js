const express = require("express");
const { forgotPassword, loginUser, resetPassword } = require("../controllers/userController");

const router = express.Router();

router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
