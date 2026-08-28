import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIFeedback } from '../context/UIFeedbackContext';

const HeartIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

// Heart toggle used on car cards and the car detail page. Stops event
// propagation so it works when nested inside a clickable card without
// also triggering the card's own navigation.
const FavoriteButton = ({ carId, canFavorite, isFavorite, onToggle, size = 32, style }) => {
  const navigate = useNavigate();
  const { toast } = useUIFeedback();
  const [working, setWorking] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canFavorite) {
      toast.info('Log in as a client to save vehicles to your favorites.');
      navigate('/login');
      return;
    }
    setWorking(true);
    try {
      await onToggle(carId);
    } catch {
      toast.error('Something went wrong updating your favorites.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <button
      type="button"
      className="icon-toggle-btn"
      onClick={handleClick}
      onKeyDown={(e) => e.stopPropagation()}
      disabled={working}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorite}
      style={{
        width: size, height: size, borderRadius: '50%', border: 'none',
        background: 'rgba(0,0,0,0.45)', color: isFavorite ? '#ef4444' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        ...style,
      }}
    >
      <HeartIcon filled={isFavorite} />
    </button>
  );
};

export default FavoriteButton;
