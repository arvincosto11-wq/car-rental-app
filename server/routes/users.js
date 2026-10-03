import express from 'express';
import User from '../models/User.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { notifyUser } from '../utils/notify.js';

const router = express.Router();

// Get all clients (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Correcting somebody's document dates, read off the real ID or licence at
// the counter. The client enters their own when they register, which is a
// claim rather than a fact — this is how the person who has actually seen
// the document puts it right.
router.put('/:id/document-dates', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.body.validIdExpiry !== undefined) user.validIdExpiry = req.body.validIdExpiry || null;
    if (req.body.licenseExpiry !== undefined) user.licenseExpiry = req.body.licenseExpiry || null;
    await user.save();
    res.json({ validIdExpiry: user.validIdExpiry, licenseExpiry: user.licenseExpiry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Block or unblock a client (admin)
router.put('/:id/block', protect, adminOnly, async (req, res) => {
  try {
    const { blocked } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: blocked },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get the logged-in user's favorited cars (populated)
router.get('/favorites', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    res.json(user?.favorites || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add/remove a car from the logged-in user's favorites
router.put('/favorites/:carId/toggle', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const idx = user.favorites.findIndex((id) => id.toString() === req.params.carId);
    let favorited;
    if (idx === -1) {
      user.favorites.push(req.params.carId);
      favorited = true;
    } else {
      user.favorites.splice(idx, 1);
      favorited = false;
    }
    await user.save();
    res.json({ favorited });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;