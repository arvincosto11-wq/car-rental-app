import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import EmailVerification from '../models/EmailVerification.js';
import { protect } from '../middleware/auth.js';
import { loginLimiter, registerLimiter, verificationLimiter } from '../middleware/rateLimit.js';
import { sendVerificationCodeEmail } from '../utils/email.js';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFIED_WINDOW_MS = 30 * 60 * 1000;

// Get the logged-in user's own profile (used to check things like license status before booking)
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update the logged-in user's own basic profile info.
// Deliberately excludes email, password, role, isBlocked, and idVerified —
// those are either security-sensitive or admin-controlled.
router.put('/me', protect, async (req, res) => {
  try {
    const {
      name, phone, address,
      licenseNumber, licenseExpiry,
      emergencyContactName, emergencyContactNumber,
      validIdImage, validIdImageFileId
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (licenseNumber !== undefined) user.licenseNumber = licenseNumber;
    if (licenseExpiry !== undefined) user.licenseExpiry = licenseExpiry;
    if (emergencyContactName !== undefined) user.emergencyContactName = emergencyContactName;
    if (emergencyContactNumber !== undefined) user.emergencyContactNumber = emergencyContactNumber;

    // If they upload a new ID photo, it needs to be re-verified by admin
    if (validIdImage && validIdImage !== user.validIdImage) {
      user.validIdImage = validIdImage;
      user.validIdImageFileId = validIdImageFileId || '';
      user.idVerified = false;
    }

    await user.save();
    const { password, ...safeUser } = user.toObject();
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sends a code to the logged-in user's own email before they're allowed to
// change their password — requires the correct current password first so a
// code isn't wasted (and the owner isn't emailed) over a wrong guess.
router.post('/change-password/send-code', protect, verificationLimiter, async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword || '', user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await EmailVerification.findOneAndUpdate(
      { email: user.email },
      { email: user.email, code, attempts: 0, verified: false, expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await sendVerificationCodeEmail(user.email, code, 'change-password');
    res.json({ message: 'Verification code sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forgot password — sends a code if an account exists for that email, but
// always returns the same generic response either way so the response
// itself can't be used to enumerate which emails are registered.
router.post('/forgot-password', verificationLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!EMAIL_REGEX.test(email || '')) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const user = await User.findOne({ email });
    if (user) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await EmailVerification.findOneAndUpdate(
        { email },
        { email, code, attempts: 0, verified: false, expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await sendVerificationCodeEmail(email, code, 'reset-password');
    }

    res.json({ message: 'If an account exists with that email, a verification code has been sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset password — requires a code already confirmed via
// POST /verify-email-code (same verified-flag gate used everywhere else).
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid request.' });

    const verification = await EmailVerification.findOne({ email });
    if (!verification?.verified || verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Please verify your email before resetting your password.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await EmailVerification.deleteOne({ email });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Change the logged-in user's password — requires the current password AND
// a code confirmed via POST /verify-email-code first (that endpoint marks
// EmailVerification.verified for whatever email the code matched; this
// route just checks that flag rather than re-checking the raw code).
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword || '', user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });

    const verification = await EmailVerification.findOne({ email: user.email });
    if (!verification?.verified || verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Please verify your email before changing your password.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await EmailVerification.deleteOne({ email: user.email });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a 6-digit code to the given email, to be confirmed via
// POST /verify-email-code before registration is allowed to proceed.
router.post('/send-verification-code', verificationLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!EMAIL_REGEX.test(email || '')) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    // A fresh request always overwrites any previous code for this email —
    // upsert so re-sending invalidates whatever code was sent before.
    await EmailVerification.findOneAndUpdate(
      { email },
      { email, code, attempts: 0, verified: false, expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendVerificationCodeEmail(email, code);
    res.json({ message: 'Verification code sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Confirm the code the client just entered. On success, the email is
// marked verified for a 30-minute window so the rest of the multi-step
// register form can still be filled out before actually submitting.
router.post('/verify-email-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Missing email or code.' });

    const record = await EmailVerification.findOne({ email });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ message: 'That code has expired. Please request a new one.' });
    }
    if (record.attempts >= 5) {
      return res.status(400).json({ message: 'Too many incorrect attempts. Please request a new code.' });
    }
    if (record.code !== String(code).trim()) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ message: 'Incorrect code. Please try again.' });
    }

    record.verified = true;
    record.expiresAt = new Date(Date.now() + VERIFIED_WINDOW_MS);
    await record.save();
    res.json({ message: 'Email verified.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const {
      name, email, password, phone, address,
      validIdImage, validIdImageFileId,
      licenseNumber, licenseExpiry,
      emergencyContactName, emergencyContactNumber
    } = req.body;

    if (!EMAIL_REGEX.test(email || '')) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    // The whole point of the verification step — without this check it
    // would just be UI theater, since anyone could call this endpoint
    // directly and skip straight past it.
    const verification = await EmailVerification.findOne({ email });
    if (!verification?.verified || verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Please verify your email before registering.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hashed,
      phone, address,
      validIdImage, validIdImageFileId,
      licenseNumber, licenseExpiry,
      emergencyContactName, emergencyContactNumber
    });

    await EmailVerification.deleteOne({ email });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name, email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;