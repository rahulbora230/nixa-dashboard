const canViewAll = (user) => user?.role === "admin" || user?.role === "accountant";
const canManageUsers = (user) => user?.role === "admin";
const canManageReleases = (user) => ["admin", "artist", "label"].includes(user?.role);
const canManageFinance = (user) => ["admin", "accountant"].includes(user?.role);
const canProcessPayouts = (user) => ["admin", "accountant"].includes(user?.role);
const canViewOwnData = (user) => ["artist", "label", "accountant", "admin"].includes(user?.role);
const canViewLabelData = (user) => ["admin", "accountant", "label"].includes(user?.role);

const requirePermission = (check, message = "You do not have permission to perform this action.") => (req, res, next) => {
  if (!check(req.user)) {
    return res.status(403).json({ message });
  }

  return next();
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission to perform this action." });
  }

  return next();
};

module.exports = {
  canViewAll,
  canManageUsers,
  canManageReleases,
  canManageFinance,
  canProcessPayouts,
  canViewOwnData,
  canViewLabelData,
  requirePermission,
  requireRoles,
};
