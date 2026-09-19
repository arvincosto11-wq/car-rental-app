import express from 'express';
import LongRentalDiscount from '../models/LongRentalDiscount.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { validateLongRentalRule } from '../utils/longRental.js';

const router = express.Router();

// Public: the active rules, so vehicle pages can show "Book 7+ days, save
// 10%" and preview the discount. The server recomputes every price itself
// at booking time — this is display only.
router.get('/', async (req, res) => {
  try {
    const rules = await LongRentalDiscount.find({ active: true }).sort({ minDays: 1 }).lean();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: every rule, including paused ones.
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const rules = await LongRentalDiscount.find().sort({ minDays: 1 }).lean();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const cleanRule = ({ minDays, percent, appliesTo, cars, active }) => ({
  minDays: Number(minDays),
  percent: Number(percent),
  appliesTo,
  // A fixed list only means something for 'selected'; clearing it for 'all'
  // stops a stale list from silently coming back if the rule is switched.
  cars: appliesTo === 'selected' ? cars : [],
  active: active !== false,
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const problem = validateLongRentalRule(req.body);
    if (problem) return res.status(400).json({ message: problem });
    const rule = await LongRentalDiscount.create(cleanRule(req.body));
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const problem = validateLongRentalRule(req.body);
    if (problem) return res.status(400).json({ message: problem });
    const rule = await LongRentalDiscount.findByIdAndUpdate(req.params.id, cleanRule(req.body), { new: true });
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Safe at any time: bookings already made keep the discount and label they
// were priced with, stored on the booking itself.
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const rule = await LongRentalDiscount.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
