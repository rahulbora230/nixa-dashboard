import React from "react";
import { useNavigate } from "react-router-dom";

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        background: "#ef4444",
        border: "none",
        color: "#fff",
        padding: "10px 18px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "600",
      }}
    >
      Logout
    </button>
  );
};

export default LogoutButton;