import { useCallback, useEffect, useState } from "react";
import { CheckCheck, RefreshCw } from "lucide-react";
import EmptyState from "../../components/ui/EmptyState";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import { notificationService } from "../../services/notificationService";
import { formatDate } from "../../utils/formatters";
import "../management/Management.css";

const Notifications = () => {
  const [filters, setFilters] = useState({ unread: "", type: "", page: 1, limit: 20, mine: true });
  const [data, setData] = useState({ notifications: [], pagination: { page: 1, totalPages: 1 }, unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const result = await notificationService.getNotifications(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load notifications." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const markAllRead = async () => {
    await notificationService.markAllRead();
    setToast({ type: "success", message: "Notifications marked read." });
    loadNotifications();
  };

  return (
    <div className="page-stack management-workspace">
      <PageHeader
        eyebrow="Notifications"
        title="Stay current on releases, revenue, payouts, invoices and account activity."
        description={`${data.unreadCount || 0} unread notifications`}
        actions={(
          <>
            <button className="secondary-button" type="button" onClick={loadNotifications}>
              <RefreshCw size={17} />
              Refresh
            </button>
            <button className="primary-button" type="button" onClick={markAllRead}>
              <CheckCheck size={17} />
              Mark Read
            </button>
          </>
        )}
      />

      <section className="management-toolbar">
        <select value={filters.unread} onChange={(event) => updateFilter("unread", event.target.value)}>
          <option value="">All notifications</option>
          <option value="true">Unread only</option>
        </select>
        <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
          <option value="">All types</option>
          <option value="security">Security</option>
          <option value="user_created">User created</option>
          <option value="profile_update">Profile update</option>
          <option value="payout">Payout</option>
          <option value="invoice">Invoice</option>
        </select>
      </section>

      <section className="panel">
        {loading ? <LoadingSkeleton rows={8} /> : data.notifications.length ? (
          <div className="activity-feed">
            {data.notifications.map((notification) => (
              <div className="activity-row" key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                </div>
                <div className="management-actions">
                  <StatusBadge status={notification.isRead ? "read" : "pending"}>{notification.isRead ? "read" : "unread"}</StatusBadge>
                  <small>{formatDate(notification.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No notifications" message="System alerts and workflow activity will appear here." />
        )}
      </section>

      <div className="pagination-row">
        <button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>Previous</button>
        <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
        <button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter("page", filters.page + 1)}>Next</button>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default Notifications;
