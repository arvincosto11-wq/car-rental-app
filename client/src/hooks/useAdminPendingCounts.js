// Thin re-export so existing imports keep working — the actual polling
// logic lives in AdminPendingCountsContext so pages other than AdminLayout
// (Manage Clients, Manage Bookings, etc.) can also pull `refetch` and
// trigger an instant badge update right after resolving something.
export { useAdminPendingCounts as default } from '../context/AdminPendingCountsContext';
