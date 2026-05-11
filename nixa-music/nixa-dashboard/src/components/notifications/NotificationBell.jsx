import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { notificationService } from "../../services/notificationService";
import { formatDate } from "../../utils/formatters";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });

  const loadNotifications = useCallback(async () => {
    try {
      const result = await notificationService.getNotifications({ limit: 8, mine: true });
      setData(result);
    } catch {
      setData({ notifications: [], unreadCount: 0 });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  const markAllRead = async () => {
    await notificationService.markAllRead();
    loadNotifications();
  };

  const markRead = async (notification) => {
    if (!notification.isRead) {
      await notificationService.markRead(notification.id);
      loadNotifications();
    }
  };

  return (
    <div className="notification-wrap">
      <button className="icon-button notification-button" type="button" aria-label="Notifications" onClick={() => setOpen((current) => !current)}>
        <Bell size={18} />
        {data.unreadCount > 0 && <span className="notification-count">{data.unreadCount > 99 ? "99+" : data.unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-dropdown">
          <header>
            <strong>Notifications</strong>
            <button className="icon-button" type="button" aria-label="Mark all read" onClick={markAllRead}>
              <CheckCheck size={16} />
            </button>
          </header>
          <div className="notification-list">
            {data.notifications.length ? data.notifications.map((notification) => (
              <button
                className={notification.isRead ? "notification-item" : "notification-item unread"}
                key={notification.id}
                type="button"
                onClick={() => markRead(notification)}
              >
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <small>{formatDate(notification.createdAt)}</small>
              </button>
            )) : (
              <div className="notification-item">
                <strong>No notifications</strong>
                <p>You are all caught up.</p>
              </div>
            )}
          </div>
          <footer>
            <Link className="secondary-button" to="/notifications" onClick={() => setOpen(false)}>View All</Link>
          </footer>
        </section>
      )}
    </div>
  );
};

export default NotificationBell;
