import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../api';

// Live "needs attention" counts per admin section — NOT notification-based
// (see server/routes/adminStats.js for why: a notification staying unread
// doesn't mean the underlying item is still unresolved). Shared as a
// context (rather than a plain hook) so that admin pages which resolve an
// item — verifying an ID, confirming a booking, approving a request — can
// call refetch() right after their own mutation succeeds. That clears the
// sidebar dot the moment the task is actually done, instead of waiting on
// the 30s poll or a full page reload.
const AdminPendingCountsContext = createContext({ counts: {}, refetch: () => {} });

export const AdminPendingCountsProvider = ({ children }) => {
  const { user } = useAuth();
  const [counts, setCounts] = useState({});

  const fetchCounts = useCallback(async () => {
    if (!user || user.role !== 'admin') { setCounts({}); return; }
    try {
      const res = await api.get('/admin/pending-counts');
      setCounts(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return (
    <AdminPendingCountsContext.Provider value={{ counts, refetch: fetchCounts }}>
      {children}
    </AdminPendingCountsContext.Provider>
  );
};

export const useAdminPendingCounts = () => useContext(AdminPendingCountsContext);

export default AdminPendingCountsContext;
