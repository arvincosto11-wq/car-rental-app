import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../api';

const NotificationContext = createContext();

// Single source of truth for notifications, shared by the bell icon and any
// nav item that wants its own badge (e.g. "Manage Bookings" showing how many
// of its own unread notifications there are) — avoids each one polling the
// API separately and falling out of sync with each other.
export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); return; }
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.put('/notifications/read-all');
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Unread count scoped to a specific section, e.g. unreadCountFor('/admin/manage-bookings')
  // — used to badge individual nav items instead of just the bell's total.
  const unreadCountFor = (linkPrefix) =>
    notifications.filter((n) => !n.read && n.link?.startsWith(linkPrefix)).length;

  // Marks every unread notification pointing into a given section as read —
  // called when a page like My Bookings or My Vehicles actually loads, so a
  // client seeing the update in context clears the nav badge right then
  // instead of it staying lit until they separately open the bell dropdown
  // and click each one.
  const markReadByLinkPrefix = (linkPrefix) => {
    notifications
      .filter((n) => !n.read && n.link?.startsWith(linkPrefix))
      .forEach((n) => markRead(n._id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, unreadCountFor, markReadByLinkPrefix,
      markRead, markAllRead, deleteNotification, refetch: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
