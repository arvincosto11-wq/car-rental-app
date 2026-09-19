import express from 'express';
import LongRentalDiscount from '../models/LongRentalDiscount.js';
import { protect, adminOnly } from '../middleware/auth.js';
import Car from '../models/Car.js';
import { validateLongRentalRule, findRuleConflicts, conflictMessage } from '../utils/longRental.js';

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

// Refuses a rule that would give the same vehicle two discounts starting at
// the same trip length. Returns an error message, or null. Only checked when
// the rule would be active, so pausing always works and resuming re-checks.
const clashFor = async (rule, ignoreId) => {
  if (rule.active === false) return null;
  const active = await LongRentalDiscount.find({ active: true }).lean();
  const conflicts = findRuleConflicts(rule, active, ignoreId);
  if (!conflicts.length) return null;
  const ids = conflicts[0].shared === 'all' ? [] : conflicts[0].shared;
  const cars = await Car.find({ _id: { $in: ids } }).select('brand model').lean();
  const names = Object.fromEntries(cars.map((c) => [String(c._id), `${c.brand} ${c.model}`]));
  return conflictMessage(conflicts, (id) => names[id] || 'A vehicle', rule);
};

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
    const clean = cleanRule(req.body);
    const clash = await clashFor(clean, null);
    if (clash) return res.status(400).json({ message: clash });
    const rule = await LongRentalDiscount.create(clean);
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const problem = validateLongRentalRule(req.body);
    if (problem) return res.status(400).json({ message: problem });
    const clean = cleanRule(req.body);
    const clash = await clashFor(clean, req.params.id);
    if (clash) return res.status(400).json({ message: clash });
    const rule = await LongRentalDiscount.findByIdAndUpdate(req.params.id, clean, { new: true });
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
