import { Link, useLocation, useNavigate } from "react-router-dom";
import LogoutButton from "./LogoutButton";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const linkStyle = (path) => ({
    display: "block",
    padding: "10px 15px",
    marginBottom: 10,
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    transition: "0.2s",
    color:
      location.pathname === path
        ? "#00FFAA"
        : "#aaa",

    background:
      location.pathname === path
        ? "#1A222C"
        : "transparent",

    borderLeft:
      location.pathname === path
        ? "3px solid #00FFAA"
        : "3px solid transparent",
  });

  const itemStyle = {
    padding: "10px 15px",
    marginBottom: 10,
    borderRadius: 8,
    cursor: "pointer",
    color: "#aaa",
    fontSize: 14,
  };

  return (
    <div
      style={{
        width: 220,
        background: "#11161D",
        height: "100vh",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // important
      }}
    >
      {/* Scrollable Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: 5,
        }}
      >
        <h2 style={{ marginBottom: 30 }}>Nixa</h2>

        <Link to="/" style={linkStyle("/")}>
          Dashboard
        </Link>

        <Link
          to="/revenue"
          style={linkStyle("/revenue")}
        >
          Revenue
        </Link>

        <Link
          to="/payouts"
          style={linkStyle("/payouts")}
        >
          Payouts
        </Link>

        <Link
          to="/analytics"
          style={linkStyle("/analytics")}
        >
          Analytics
        </Link>

        <Link
          to="/admin/releases"
          style={linkStyle("/admin/releases")}
        >
          Admin Releases
        </Link>

        <Link
          to="/createrelease"
          style={linkStyle("/createrelease")}
        >
          Create Release
        </Link>

        <Link
          to="/admin/users"
          style={linkStyle("/admin/users")}
        >
          User Management
        </Link>

        <div
          style={itemStyle}
          onClick={() => navigate("/upload")}
        >
          Upload Revenue
        </div>

        {/* Extra Demo Items */}
        <Link
          to="/settings"
          style={linkStyle("/settings")}
        >
          Settings
        </Link>

        <Link
          to="/finance"
          style={linkStyle("/finance")}
        >
          Finance
        </Link>

        <Link
          to="/catalog"
          style={linkStyle("/catalog")}
        >
          Catalog
        </Link>

        <Link
          to="/reports"
          style={linkStyle("/reports")}
        >
          Reports
        </Link>
      </div>

      {/* Fixed Logout Bottom */}
      <div
        style={{
          paddingTop: 15,
          borderTop: "1px solid #222",
        }}
      >
        <LogoutButton />
      </div>
    </div>
  );
};

export default Sidebar;