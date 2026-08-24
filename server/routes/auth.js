import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

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

// Register
router.post('/register', async (req, res) => {
  try {
    const {
      name, email, password, phone, address,
      validIdImage, validIdImageFileId,
      licenseNumber, licenseExpiry,
      emergencyContactName, emergencyContactNumber
    } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hashed,
      phone, address,
      validIdImage, validIdImageFileId,
      licenseNumber, licenseExpiry,
      emergencyContactName, emergencyContactNumber
    });

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
router.post('/login', async (req, res) => {
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

// Temporary admin setup route - remove after use
router.post('/make-admin', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { email: req.body.email },
      { role: 'admin' },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User is now admin', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;