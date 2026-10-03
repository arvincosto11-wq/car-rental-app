import { useState, useEffect } from 'react';
import api from '../api';

// Tells somebody their address is already registered while they are still
// filling the form in, rather than after they have finished it.
//
// Both sign-up forms already did this for phone numbers; an address that
// turns out to be taken on the last click is the more annoying of the two,
// because by then they have chosen a password and typed an address.
//
// Debounced, and the answer carries the address it was about. Comparing the
// two is what stops a slow reply about an old address appearing under a new
// one — the same reason the place search keeps its query with its results.
//
// It never blocks on its own. A failed or pending check reports nothing,
// and the registration route is what actually refuses a duplicate.
const useEmailAvailable = (email) => {
  const [answer, setAnswer] = useState({ email: '', taken: false });

  useEffect(() => {
    const value = String(email || '').trim();
    // Not an address yet. No opinion on something half typed.
    if (!value || !value.includes('@') || !value.includes('.')) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      api.get('/auth/email-available', { params: { email: value } })
        .then((res) => { if (live) setAnswer({ email: value, taken: res.data.checked && !res.data.available }); })
        .catch(() => { if (live) setAnswer({ email: value, taken: false }); });
    }, 500);
    return () => { live = false; clearTimeout(timer); };
  }, [email]);

  const current = String(email || '').trim();
  return answer.email === current && answer.taken;
};

export default useEmailAvailable;
