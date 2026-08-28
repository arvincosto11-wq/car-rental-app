import { useEffect } from 'react';

// Sets the browser tab title for the page that calls it, restoring the
// previous title on unmount (so a page navigated away from doesn't leave
// a stale title behind if something else changes it later).
const usePageTitle = (title) => {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Rent-a-Ride Albay` : 'Rent-a-Ride Albay';
    return () => { document.title = previous; };
  }, [title]);
};

export default usePageTitle;
