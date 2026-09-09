import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// Renders nothing if the app isn't configured with a Google Client ID yet
// (e.g. local dev before it's been set up) instead of crashing the page.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const GoogleAuthButton = ({ onError, isDark }) => {
  const { login } = useAuth();
  const navigate = useNavigate();

  if (!GOOGLE_CLIENT_ID) return null;

  const handleSuccess = async (credentialResponse) => {
    try {
      const res = await api.post('/auth/google', { credential: credentialResponse.credential });
      login(res.data.user, res.data.token);
      const role = res.data.user.role;
      navigate(role === 'admin' ? '/admin' : role === 'consignor' ? '/consignor' : '/my-bookings');
    } catch (err) {
      onError?.(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => onError?.('Google sign-in failed. Please try again.')}
      theme={isDark ? 'filled_black' : 'outline'}
      width="100%"
    />
  );
};

export default GoogleAuthButton;
