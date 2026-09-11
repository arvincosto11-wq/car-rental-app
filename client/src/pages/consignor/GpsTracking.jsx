import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import GpsTrackingView from '../../components/GpsTrackingView';
import BackButton from '../../components/BackButton';
import usePageTitle from '../../hooks/usePageTitle';

const ConsignorGpsTracking = () => {
  usePageTitle('GPS Tracking');
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb' },
    container: { maxWidth: '1100px', margin: '0 auto', padding: '32px 16px' },
    title: { fontSize: '22px', fontWeight: '700', marginBottom: '4px', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <BackButton text="Back to My Vehicles" onClick={() => navigate('/consignor')} />
        <h1 style={s.title}>GPS Tracking</h1>
        <p style={s.subtitle}>Live positions for the vehicles you've listed.</p>
        <GpsTrackingView />
      </div>
    </div>
  );
};

export default ConsignorGpsTracking;
