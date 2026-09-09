import { useState, useEffect } from 'react';

// Tracks a countdown (seconds) for a "resend code" action so it can't be
// spam-clicked right after sending. Call start() when a code goes out;
// secondsLeft counts down to 0 on its own.
const useResendCooldown = (seconds = 30) => {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft > 0]);

  const start = () => setSecondsLeft(seconds);

  return [secondsLeft, start];
};

export default useResendCooldown;
