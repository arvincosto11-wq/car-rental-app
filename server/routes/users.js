import express from 'express';
import User from '../models/User.js';
import Car from '../models/Car.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { notifyUser } from '../utils/notify.js';

const router = express.Router();

// Clients, or vehicle owners (admin).
//
// One endpoint rather than two, because the two lists want the same fields
// and differ only in who is on them. Anything but 'consignor' means the
// clients, so every caller written before owners were listed at all keeps
// getting exactly what it got.
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const role = req.query.role === 'consignor' ? 'consignor' : 'user';
    const users = await User.find({ role })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    if (role !== 'consignor') return res.json(users);

    // How many vehicles each owner has with us, so the list says something
    // about them before anybody opens anything. Counted in one query
    // rather than one per owner.
    const counts = await Car.aggregate([
      { $match: { owner: { $ne: null } } },
      { $group: { _id: '$owner', total: { $sum: 1 }, live: { $sum: { $cond: [{ $ne: ['$archived', true] }, 1, 0] } } } },
    ]);
    const byOwner = new Map(counts.map((c) => [String(c._id), c]));
    res.json(users.map((u) => ({
      ...u,
      vehicleCount: byOwner.get(String(u._id))?.total || 0,
      liveVehicleCount: byOwner.get(String(u._id))?.live || 0,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Putting a vehicle owner's contract on hold, or taking it off hold.
//
// Their vehicles come down with them: an owner on hold whose cars are
// still earning is not on hold. Archiving is what takes a vehicle off
// every list without deleting anything, and it deliberately leaves
// bookings alone — somebody who has already paid for next week still
// collects their car. They did nothing wrong.
//
// The cars we take down are marked, so lifting the hold brings back those
// and only those. A car archived months ago for its own reasons stays
// where it is.
router.put('/:id/suspend', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'consignor') {
      return res.status(400).json({ message: 'Only a vehicle owner has a contract to put on hold.' });
    }

    const suspend = !!req.body.suspended;
    if (suspend) {
      const reason = String(req.body.reason || '').trim().slice(0, 300);
      if (!reason) {
        return res.status(400).json({ message: 'Please say why. The owner reads this on their own page.' });
      }
      user.suspension = { at: new Date(), reason };
      await user.save();

      const { modifiedCount } = await Car.updateMany(
        { owner: user._id, archived: { $ne: true } },
        { $set: { archived: true, archivedAt: new Date(), archivedBySuspension: true } },
      );

      await notifyUser(
        user._id,
        'Your contract is on hold',
        `${reason} Your vehicles have been taken off the site while this is sorted out. `
        + 'Bookings already made will go ahead as normal. Please call us on 0950-651-0479.',
        '/consignor',
        { email: true },
      );
      return res.json({ suspension: user.suspension, vehiclesArchived: modifiedCount });
    }

    user.suspension = { at: null, reason: '' };
    await user.save();
    const { modifiedCount } = await Car.updateMany(
      { owner: user._id, archivedBySuspension: true },
      { $set: { archived: false, archivedBySuspension: false }, $unset: { archivedAt: '' } },
    );

    await notifyUser(
      user._id,
      'Your contract is active again',
      'Your contract is off hold and your vehicles are back on the site. Thank you for sorting it out.',
      '/consignor',
      { email: true },
    );
    res.json({ suspension: user.suspension, vehiclesRestored: modifiedCount });
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
    if (req.body.licenseExpiry !== undefined) user.licenseExpiry = req.body.licenseExpiry || null;
    await user.save();
    res.json({ licenseExpiry: user.licenseExpiry });
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