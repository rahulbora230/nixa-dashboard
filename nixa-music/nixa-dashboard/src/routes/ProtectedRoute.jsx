import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getRoleHomePath } from "../utils/navigation";

const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to={getRoleHomePath(role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
