import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// Live "needs attention" counts per admin section — NOT notification-based
// (see server/routes/adminStats.js for why: a notification staying unread
// doesn't mean the underlying item is still unresolved). Polled the same
// way notifications are, so a badge clears within ~30s of the admin
// actually handling the item, regardless of whether they opened the bell.
const useAdminPendingCounts = () => {
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

  return { counts, refetch: fetchCounts };
};

export default useAdminPendingCounts;
