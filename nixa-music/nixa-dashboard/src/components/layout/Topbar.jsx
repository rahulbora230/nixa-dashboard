import { Menu, Search, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import NotificationBell from "../notifications/NotificationBell";

const Topbar = ({ title, subtitle, onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-button menu-button" type="button" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div>
          <p className="eyebrow">Nixa Music SaaS</p>
          <h1>{title}</h1>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="search-box">
          <Search size={17} />
          <input type="search" placeholder="Search catalog, ISRC, artist" />
        </label>
        <button className="ghost-button" type="button">
          <SlidersHorizontal size={17} />
          Filters
        </button>
        <NotificationBell />
        <div className="avatar" title={user?.name || "Nixa User"}>
          {(user?.name || "N").slice(0, 1).toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
