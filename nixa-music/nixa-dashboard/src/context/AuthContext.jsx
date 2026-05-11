import { useCallback, useMemo, useState } from "react";
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

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback(async (credentials) => {
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
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

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
