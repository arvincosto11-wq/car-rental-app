import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// Renders nothing if the app isn't configured with a Google Client ID yet
// (e.g. local dev before it's been set up) instead of crashing the page.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Google's own pre-built <GoogleLogin> button auto-personalizes to "Sign in
// as <name>" once the browser has an active Google session, which reads
// like a stray debug widget rather than a normal sign-in button. Using
// useGoogleLogin instead means we render our own plain, consistent button
// and only borrow Google's auth flow, not its widget UI.
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const GoogleAuthButton = ({ onError, isDark }) => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async (tokenResponse) => {
    try {
      const res = await api.post('/auth/google', { accessToken: tokenResponse.access_token });
      login(res.data.user, res.data.token);
      const role = res.data.user.role;
      navigate(role === 'admin' ? '/admin' : role === 'consignor' ? '/consignor' : '/my-bookings');
    } catch (err) {
      onError?.(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleSuccess,
    onError: () => onError?.('Google sign-in failed. Please try again.'),
  });

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <button
      type="button"
      onClick={() => googleLogin()}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer',
        border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
        background: isDark ? '#0f172a' : '#fff',
        color: isDark ? '#f1f5f9' : '#1a1a1a',
        fontSize: '14px', fontWeight: '500',
      }}
    >
      <GoogleIcon />
      Sign in with Google
    </button>
  );
};

export default GoogleAuthButton;
