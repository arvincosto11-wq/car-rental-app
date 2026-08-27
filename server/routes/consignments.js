import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Car from '../models/Car.js';
import Consignment from '../models/Consignment.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { registerLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Register as a vehicle owner (consignor) + submit their first vehicle in one step.
// Public route — creates the User account (role: consignor) and the first
// Consignment application together, then logs them straight in.
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const {
      // Owner info
      name, email, password, phone, address, validIdImage, validIdImageFileId,
      // Vehicle info
      brand, model, year, plateNumber, color, mileage, category, transmission,
      fuelType, seats, suggestedPricePerDay, description, availableBookingTypes,
      orImage, orImageFileId, crImage, crImageFileId, vehiclePhotos
    } = req.body;

    if (!EMAIL_REGEX.test(email || '')) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hashed, phone, address,
      validIdImage, validIdImageFileId,
      role: 'consignor'
    });

    const consignment = await Consignment.create({
      owner: user._id,
      brand, model, year, plateNumber, color, mileage, category, transmission,
      fuelType, seats, suggestedPricePerDay, description, availableBookingTypes,
      orImage, orImageFileId, crImage, crImageFileId, vehiclePhotos
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name, email, role: user.role },
      consignment
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Submit an additional vehicle (owner already has an account and is logged in)
router.post('/', protect, consignorOnly, async (req, res) => {
  try {
    const {
      brand, model, year, plateNumber, color, mileage, category, transmission,
      fuelType, seats, suggestedPricePerDay, description, availableBookingTypes,
      orImage, orImageFileId, crImage, crImageFileId, vehiclePhotos
    } = req.body;

    const consignment = await Consignment.create({
      owner: req.user.id,
      brand, model, year, plateNumber, color, mileage, category, transmission,
      fuelType, seats, suggestedPricePerDay, description, availableBookingTypes,
      orImage, orImageFileId, crImage, crImageFileId, vehiclePhotos
    });

    res.status(201).json(consignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get the logged-in consignor's own vehicle applications
router.get('/my', protect, consignorOnly, async (req, res) => {
  try {
    const consignments = await Consignment.find({ owner: req.user.id })
      .populate('linkedCar')
      .sort({ createdAt: -1 });
    res.json(consignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all applications (admin review queue)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const consignments = await Consignment.find()
      .populate('owner', 'name email phone address validIdImage idVerified')
      .populate('linkedCar')
      .sort({ createdAt: -1 });
    res.json(consignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin approves or declines an application.
// On approve: creates a live Car listing from the submitted vehicle data.
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { decision, adminNotes } = req.body; // decision: 'approved' | 'declined'
    const consignment = await Consignment.findById(req.params.id);
    if (!consignment) return res.status(404).json({ message: 'Application not found' });

    if (consignment.status !== 'pending') {
      return res.status(400).json({ message: 'This application has already been reviewed.' });
    }

    consignment.status = decision;
    consignment.adminNotes = adminNotes || '';

    if (decision === 'approved') {
      const car = await Car.create({
        brand: consignment.brand,
        model: consignment.model,
        year: consignment.year,
        pricePerDay: consignment.suggestedPricePerDay,
        category: consignment.category,
        transmission: consignment.transmission,
        fuelType: consignment.fuelType,
        seats: consignment.seats,
        description: consignment.description,
        image: consignment.vehiclePhotos?.[0]?.url || '',
        imageFileId: consignment.vehiclePhotos?.[0]?.fileId || '',
        isAvailable: true,
        owner: consignment.owner,
        availableBookingTypes: consignment.availableBookingTypes?.length ? consignment.availableBookingTypes : ['self-drive', 'with-driver']
      });
      consignment.linkedCar = car._id;
    }

    await consignment.save();
    res.json(consignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
