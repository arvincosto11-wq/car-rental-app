import { useEffect, useState } from 'react';
import api from '../api';

// Short-lived links to somebody's identity documents.
//
// The photographs are asked for by whose they are, not by URL, so the server
// decides what a person may look at rather than signing whatever it is
// handed. Links last minutes, so one copied out of a browser's network tab
// is useless by the time anybody else tries it.
//
// Returns an empty object until they arrive, so a caller can fall back to
// whatever it already holds and nothing blinks out while this loads.
export default function useDocumentPhotos(userId) {
  const [photos, setPhotos] = useState({});

  useEffect(() => {
    if (!userId) {
      setPhotos({});
      return undefined;
    }
    let live = true;
    api.get(`/users/${userId}/documents`)
      .then((res) => { if (live) setPhotos(res.data || {}); })
      .catch(() => { if (live) setPhotos({}); });
    return () => { live = false; };
  }, [userId]);

  return photos;
}
