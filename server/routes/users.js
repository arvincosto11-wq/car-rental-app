import express from 'express';
import User from '../models/User.js';
import { protect, adminOnly } from '../middleware/auth.js';

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

// Verify or unverify a client's ID (admin)
router.put('/:id/verify', protect, adminOnly, async (req, res) => {
  try {
    const { verified } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { idVerified: verified },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
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