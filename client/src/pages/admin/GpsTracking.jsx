import AdminLayout from '../../components/AdminLayout';
import GpsTrackingView from '../../components/GpsTrackingView';
import { useTheme } from '../../context/ThemeContext';
import usePageTitle from '../../hooks/usePageTitle';

const GpsTracking = () => {
  usePageTitle('GPS Tracking');
  const { isDark } = useTheme();
  return (
    <AdminLayout activePage="GPS Tracking">
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', color: isDark ? '#e4e6eb' : '#1a1a1a' }}>GPS Tracking</h1>
      <p style={{ fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' }}>
        Live fleet positions across every listed vehicle.
      </p>
      <GpsTrackingView />
    </AdminLayout>
  );
};

export default GpsTracking;
