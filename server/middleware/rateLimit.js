import rateLimit from 'express-rate-limit';

// Limits repeated login attempts against a single account/IP (brute-force protection).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limits account creation to slow down spam registrations.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Too many accounts created from this device. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
