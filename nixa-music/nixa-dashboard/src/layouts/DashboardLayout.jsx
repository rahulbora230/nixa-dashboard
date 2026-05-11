import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { useAuth } from "../context/useAuth";
import { getNavigationItem } from "../utils/navigation";

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { role } = useAuth();
  const location = useLocation();
  const activeItem = getNavigationItem(role, location.pathname);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="shell-main">
        <Topbar
          title={activeItem?.label || "Dashboard"}
          subtitle={activeItem?.subtitle || "Nixa Music workspace"}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
