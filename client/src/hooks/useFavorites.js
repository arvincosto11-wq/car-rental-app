import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// Tracks the logged-in client's favorited car IDs and exposes a toggle.
// Favoriting is a client-only concept — admins/consignors don't rent cars
// themselves, so canFavorite is false for those roles.
const useFavorites = () => {
  const { user } = useAuth();
  const canFavorite = !!user && user.role === 'user';
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    if (!canFavorite) {
      setFavoriteIds(new Set());
      return;
    }
    api.get('/users/favorites')
      .then((res) => setFavoriteIds(new Set(res.data.map((c) => c._id))))
      .catch((err) => console.error(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFavorite]);

  const isFavorite = useCallback((carId) => favoriteIds.has(carId), [favoriteIds]);

  const toggleFavorite = useCallback(async (carId) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) next.delete(carId); else next.add(carId);
      return next;
    });
    try {
      await api.put(`/users/favorites/${carId}/toggle`);
    } catch (err) {
      // Roll back the optimistic update on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(carId)) next.delete(carId); else next.add(carId);
        return next;
      });
      throw err;
    }
  }, []);

  return { canFavorite, isFavorite, toggleFavorite };
};

export default useFavorites;
