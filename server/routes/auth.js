import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import EmailVerification from '../models/EmailVerification.js';
import { protect } from '../middleware/auth.js';
import { loginLimiter, registerLimiter, verificationLimiter } from '../middleware/rateLimit.js';
import { sendVerificationCodeEmail } from '../utils/email.js';
import { notifyAdmins } from '../utils/notify.js';
import { checkAndNotifyExpiringDocs } from '../utils/expiryNotify.js';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFIED_WINDOW_MS = 30 * 60 * 1000;
const MIN_AGE_YEARS = 18;

// Whole-years-old as of today, not just a calendar-year subtraction — so
// someone born on, say, Sept 20 doesn't count as 18 on Sept 1 of the year
// they turn 18.
const ageInYears = (birthDate) => {
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear = today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
};

// Get the logged-in user's own profile (used to check things like license status before booking)
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    await checkAndNotifyExpiringDocs(user);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update the logged-in user's own basic profile info.
// Deliberately excludes email, password, role, isBlocked, and idVerified —
// those are either security-sensitive or admin-controlled. birthDate is a
// special case: it's accepted here ONLY as a one-time backfill for accounts
// that predate the birthdate field (see the `!user.birthDate` guard below)
// — once set, it's locked, same as if it had been collected at registration.
router.put('/me', protect, async (req, res) => {
  try {
    const {
      name, phone, address, birthDate,
      licenseNumber,
      licenseImage, licenseImageFileId, licenseImageBack, licenseImageBackFileId,
      emergencyContactName, emergencyContactNumber,
      validIdType, validIdImage, validIdImageFileId,
      validIdImageBack, validIdImageBackFileId,
      image, imageFileId
    } = req.body;

    // Expiry dates are deliberately NOT read from this request, for either
    // document. A date the holder types is a claim about their own papers
    // and worth nothing — commercial rental systems read it off the scanned
    // document for exactly that reason. Admin enters both from the photo
    // they are already looking at. Anything sent here is ignored rather
    // than refused, so an older client build simply has no effect.

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    // Profile photo — purely cosmetic (avatar in the navbar/admin lists),
    // not gated behind admin review the way the valid ID is.
    if (image) { user.image = image; user.imageFileId = imageFileId || ''; }
    // Held back below for a verified client, the same as the ID. Applied
    // directly only while there is nothing verified to protect.
    const licenceChanged =
      (licenseNumber !== undefined && String(licenseNumber || '') !== String(user.licenseNumber || ''))
      || (licenseImage && licenseImage !== user.licenseImage)
      || (licenseImageBack && licenseImageBack !== user.licenseImageBack);
    if (emergencyContactName !== undefined) user.emergencyContactName = emergencyContactName;
    if (emergencyContactNumber !== undefined) user.emergencyContactNumber = emergencyContactNumber;

    if (birthDate && !user.birthDate) {
      if (ageInYears(birthDate) < MIN_AGE_YEARS) {
        return res.status(400).json({ message: `You must be at least ${MIN_AGE_YEARS} years old.` });
      }
      user.birthDate = birthDate;
    }

    // A new front/back photo or switching ID type means admin has to look
    // at it again — the expiry date alone changing doesn't (same photo,
    // nothing new to review).
    const idPhotoChanged =
      (validIdType && validIdType !== user.validIdType) ||
      (validIdImage && validIdImage !== user.validIdImage) ||
      (validIdImageBack && validIdImageBack !== user.validIdImageBack);
    // Renamed in spirit: it is any change to the ID, the date included.
    const wentPending = (idPhotoChanged || licenceChanged) && user.idVerified;

    if (wentPending) {
      if (validIdType) user.pendingValidIdType = validIdType;
      if (validIdImage) { user.pendingValidIdImage = validIdImage; user.pendingValidIdImageFileId = validIdImageFileId || ''; }
      if (validIdImageBack) { user.pendingValidIdImageBack = validIdImageBack; user.pendingValidIdImageBackFileId = validIdImageBackFileId || ''; }
      if (licenceChanged) {
        if (licenseNumber !== undefined) user.pendingLicenseNumber = licenseNumber || '';
        if (licenseImage) { user.pendingLicenseImage = licenseImage; user.pendingLicenseImageFileId = licenseImageFileId || ''; }
        if (licenseImageBack) { user.pendingLicenseImageBack = licenseImageBack; user.pendingLicenseImageBackFileId = licenseImageBackFileId || ''; }
      }
      user.pendingIdSubmittedAt = new Date();
    } else {
      if (licenseNumber !== undefined) user.licenseNumber = licenseNumber;
      if (licenseImage) { user.licenseImage = licenseImage; user.licenseImageFileId = licenseImageFileId || ''; }
      if (licenseImageBack) { user.licenseImageBack = licenseImageBack; user.licenseImageBackFileId = licenseImageBackFileId || ''; }
      if (idPhotoChanged) {
        if (validIdType) user.validIdType = validIdType;
        if (validIdImage) { user.validIdImage = validIdImage; user.validIdImageFileId = validIdImageFileId || ''; }
        if (validIdImageBack) { user.validIdImageBack = validIdImageBack; user.validIdImageBackFileId = validIdImageBackFileId || ''; }
        user.idVerified = false;
      }
    }

    await user.save();

    if (wentPending) {
      await notifyAdmins('ID Update Pending Review', `${user.name} submitted an updated ID and is awaiting re-verification.`, '/admin/manage-clients');
    } else if (idPhotoChanged) {
      await notifyAdmins('ID Verification Needed', `${user.name} uploaded a new ID photo and needs verification.`, '/admin/manage-clients');
    }
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

// Changing the address an account signs in with.
//
// The code goes to the NEW address, not the current one. That is the whole
// point: the only thing worth proving is that whoever asked can actually
// receive mail at the address they are moving to. Sending it to the old one
// would prove nothing and, on an account whose address was never real,
// could not be delivered at all — which is exactly the state this exists to
// get out of.
//
// The current password is still required, so someone who walks up to an
// unlocked screen cannot quietly take the account over.
router.post('/change-email/send-code', protect, verificationLimiter, async (req, res) => {
  try {
    const { currentPassword, newEmail } = req.body;
    const email = String(newEmail || '').trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (email === user.email.toLowerCase()) {
      return res.status(400).json({ message: 'That is already your email address.' });
    }

    const match = await bcrypt.compare(currentPassword || '', user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });

    const taken = await User.findOne({ email });
    if (taken) return res.status(400).json({ message: 'Another account already uses that email address.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await EmailVerification.findOneAndUpdate(
      { email },
      { email, code, attempts: 0, verified: false, expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await sendVerificationCodeEmail(email, code, 'change-email');
    res.json({ message: 'Verification code sent to the new address.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Everything is re-checked here rather than trusted from the step before:
// the password, that the code for this exact address was confirmed and is
// still in date, and that nobody else has claimed the address in between.
router.put('/change-email', protect, async (req, res) => {
  try {
    const { currentPassword, newEmail } = req.body;
    const email = String(newEmail || '').trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword || '', user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });

    const verification = await EmailVerification.findOne({ email });
    if (!verification?.verified || verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Please verify the new address before switching to it.' });
    }

    const taken = await User.findOne({ email });
    if (taken) return res.status(400).json({ message: 'Another account already uses that email address.' });

    user.email = email;
    await user.save();
    await EmailVerification.deleteOne({ email });
    res.json({ message: 'Email updated successfully.', email });
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
      name, email, password, birthDate, phone, address,
      validIdType, validIdImage, validIdImageFileId,
      validIdImageBack, validIdImageBackFileId, validIdExpiry,
      licenseNumber, licenseExpiry,
      licenseImage, licenseImageFileId, licenseImageBack, licenseImageBackFileId,
      emergencyContactName, emergencyContactNumber
    } = req.body;

    if (!EMAIL_REGEX.test(email || '')) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    if (!birthDate) {
      return res.status(400).json({ message: 'Please enter your birthdate.' });
    }
    if (ageInYears(birthDate) < MIN_AGE_YEARS) {
      return res.status(400).json({ message: `You must be at least ${MIN_AGE_YEARS} years old to register.` });
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
      name, email, password: hashed, birthDate,
      phone, address,
      validIdType, validIdImage, validIdImageFileId,
      validIdImageBack, validIdImageBackFileId, validIdExpiry,
      licenseNumber, licenseExpiry,
      licenseImage, licenseImageFileId, licenseImageBack, licenseImageBackFileId,
      emergencyContactName, emergencyContactNumber
    });

    await EmailVerification.deleteOne({ email });

    if (validIdImage) {
      await notifyAdmins('ID Verification Needed', `${user.name} uploaded an ID photo and needs verification.`, '/admin/manage-clients');
    }

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