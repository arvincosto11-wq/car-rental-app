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

// Verify or unverify a client's ID (admin)
router.put('/:id/verify', protect, adminOnly, async (req, res) => {
  try {
    const { verified } = req.body;
    const wasVerified = (await User.findById(req.params.id).select('idVerified'))?.idVerified;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { idVerified: verified },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Only notify on the actual transition into verified — flip back to
    // false (an admin correction) doesn't need one.
    if (verified && !wasVerified) {
      await notifyUser(user._id, 'ID Verified', 'Your valid ID has been verified. You can now book normally.', '/profile');
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve a pending ID update — promotes the pending photo(s)/type/expiry
// (submitted by an already-verified user, see PUT /auth/me) into the live
// validId* fields and clears the pending slot. The user was never
// unverified during the wait, so idVerified just gets re-affirmed as true.
router.put('/:id/pending-id/approve', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.pendingIdSubmittedAt) {
      return res.status(400).json({ message: 'This user has no pending ID update.' });
    }

    if (user.pendingValidIdType) user.validIdType = user.pendingValidIdType;
    if (user.pendingValidIdImage) { user.validIdImage = user.pendingValidIdImage; user.validIdImageFileId = user.pendingValidIdImageFileId; }
    if (user.pendingValidIdImageBack) { user.validIdImageBack = user.pendingValidIdImageBack; user.validIdImageBackFileId = user.pendingValidIdImageBackFileId; }
    if (user.pendingValidIdExpiry !== undefined) user.validIdExpiry = user.pendingValidIdExpiry;
    user.idVerified = true;

    user.pendingValidIdType = '';
    user.pendingValidIdImage = '';
    user.pendingValidIdImageFileId = '';
    user.pendingValidIdImageBack = '';
    user.pendingValidIdImageBackFileId = '';
    user.pendingValidIdExpiry = null;
    user.pendingIdSubmittedAt = null;

    await user.save();
    await notifyUser(user._id, 'ID Update Approved', 'Your updated ID has been verified and is now active.', '/profile');

    const { password, ...safeUser } = user.toObject();
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reject a pending ID update — discards the pending submission and leaves
// the live (already-verified) ID completely untouched.
router.put('/:id/pending-id/reject', protect, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.pendingIdSubmittedAt) {
      return res.status(400).json({ message: 'This user has no pending ID update.' });
    }

    user.pendingValidIdType = '';
    user.pendingValidIdImage = '';
    user.pendingValidIdImageFileId = '';
    user.pendingValidIdImageBack = '';
    user.pendingValidIdImageBackFileId = '';
    user.pendingValidIdExpiry = null;
    user.pendingIdSubmittedAt = null;

    await user.save();
    await notifyUser(
      user._id,
      'ID Update Rejected',
      `Your submitted ID update was rejected${reason ? `: ${reason}` : '.'} Your previous verified ID is still active. Please try uploading again in your Profile.`,
      '/profile'
    );

    const { password, ...safeUser } = user.toObject();
    res.json(safeUser);
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