import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContextValue";
import { authService } from "../services/authService";
import { getRoleHomePath } from "../utils/navigation";

const readStoredUser = () => {
  const storedUser = localStorage.getItem("user");

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser);
    return user?.role ? { ...user, role: user.role.toLowerCase() } : null;
  } catch {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return null;
  }
};

const validateStoredSession = () => {
  const token = localStorage.getItem("token");
  const user = readStoredUser();
  
  if (!token || !user) {
    return false;
  }
  
  try {
    // Basic validation that token looks like JWT
    const parts = token.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback(async (credentials) => {
    try {
      const data = await authService.login(credentials);
      const normalizedUser = {
        ...data.user,
        role: data.user.role.toLowerCase(),
      };

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      setToken(data.token);
      setUser(normalizedUser);

      return {
        ...data,
        user: normalizedUser,
        homePath: getRoleHomePath(normalizedUser.role),
      };
    } catch (error) {
      // Clear invalid session
      logout();
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  // Validate session on mount and token changes
  useEffect(() => {
    if (token && !validateStoredSession()) {
      logout();
    }
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role || null,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [login, logout, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
