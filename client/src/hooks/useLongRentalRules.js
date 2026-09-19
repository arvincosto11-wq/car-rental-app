import { useEffect, useState } from 'react';
import api from '../api';

// The active long-rental rules, fetched once per page load and shared by
// every caller — the vehicles list would otherwise request them once per
// card. Display only: the server recomputes the real price at booking time.
let cached = null;
let inflight = null;

const load = () => {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api.get('/long-rental-discounts')
      .then((res) => { cached = res.data; return cached; })
      .catch(() => [])
      .finally(() => { inflight = null; });
  }
  return inflight;
};

// Called by the admin panel after a rule changes, so the next page that
// reads the rules sees the new ones.
export const invalidateLongRentalRules = () => { cached = null; };

const useLongRentalRules = () => {
  const [rules, setRules] = useState(cached || []);
  useEffect(() => {
    let alive = true;
    load().then((r) => { if (alive) setRules(r); });
    return () => { alive = false; };
  }, []);
  return rules;
};

export default useLongRentalRules;
