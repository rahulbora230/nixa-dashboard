import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import BrandMark from "./BrandMark";
import { useAuth } from "../../context/useAuth";
import { getNavigationForRole, utilityNavigation } from "../../utils/navigation";
import { titleCase } from "../../utils/formatters";

const Sidebar = ({ isOpen, onClose }) => {
  const { logout, role, user } = useAuth();
  const roleNavigation = getNavigationForRole(role);

  const handleLogout = () => {
    logout();
    onClose?.();
  };

  return (
    <>
      <aside className={isOpen ? "sidebar is-open" : "sidebar"}>
        <div className="sidebar-top">
          <BrandMark />
          <div className="role-chip">{titleCase(role || "workspace")}</div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {roleNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-utility">
          {utilityNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="sidebar-user">
          <div>
            <strong>{user?.name || "Nixa User"}</strong>
            <span>{user?.email || "secure session"}</span>
          </div>
          <button className="icon-button" type="button" onClick={handleLogout} aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {isOpen && <button className="sidebar-overlay" type="button" aria-label="Close menu" onClick={onClose} />}
    </>
  );
};

export default Sidebar;
