import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wrap any route with this to require login, and optionally restrict
// to specific roles (e.g. allowedRoles={['admin']}).
// - Not logged in -> redirect to /login
// - Logged in but wrong role -> redirect to their own dashboard
const getHomeRoute = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'consignor') return '/consignor';
  return '/my-bookings';
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
