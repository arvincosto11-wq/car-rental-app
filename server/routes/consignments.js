import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import EmailVerification from '../models/EmailVerification.js';
import Car from '../models/Car.js';
import Consignment from '../models/Consignment.js';
import Booking from '../models/Booking.js';
import { sumSplit } from '../utils/revenueShare.js';
import { plateClash, plateClashMessage } from '../utils/plates.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { sameEmail } from '../middleware/email.js';
import { registerLimiter } from '../middleware/rateLimit.js';
import { notifyUser } from '../utils/notify.js';
import { fail } from '../utils/respond.js';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

// Register as a vehicle owner (consignor) + submit their first vehicle in one step.
// Public route — creates the User account (role: consignor) and logs them
// straight in.
//
// It used to create a vehicle application at the same time, from details and
// photographs typed into the form. Nothing about a vehicle is entered online
// any more: every one is looked at in person, against its papers, and
// entered at the office. So this makes an account and nothing else, and the
// account lands on the page that books that visit.
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const {
      // Owner info
      name, email, password, birthDate, phone, address,
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

    const exists = await User.findOne(sameEmail(email));
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    // The same gate the client sign-up has, and it was missing here.
    //
    // Everything a vehicle owner is ever told goes to this address: when
    // their inspection is, whether the vehicle passed, every booking on it.
    // A typo means they hear none of it and cannot reset their password;
    // somebody else's address means a stranger is told about a vehicle that
    // is not theirs. Checked on the server, so calling the API directly does
    // not skip it.
    const verification = await EmailVerification.findOne({ email });
    if (!verification?.verified || verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Please verify your email before registering.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hashed, birthDate, phone, address,
      role: 'consignor'
    });

    await EmailVerification.deleteOne({ email });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name, email, role: user.role, image: user.image || '' },
    });
  } catch (err) {
    fail(res, err);
  }
});

// A consignor used to submit an additional vehicle by filling in a form
// here. That route is gone, and this note is what is left of it.
//
// Vehicles are not consigned by description any more. A consignor books an
// inspection and brings the vehicle in, and the listing is made at the
// counter from the vehicle and its papers — see POST /cars, which creates
// the application already approved because somebody has just stood next to
// the thing and read its CR.
//
// Leaving the old route in place meant a logged-in consignor could still
// post an application for a vehicle nobody had seen, which is precisely
// the rule the inspection flow was introduced to enforce. Nothing had
// called it since that change. Found by listing the routes nothing calls.

// Get the logged-in consignor's own vehicle applications
router.get('/my', protect, consignorOnly, async (req, res) => {
  try {
    const consignments = await Consignment.find({ owner: req.user.id })
      .populate('linkedCar')
      .sort({ createdAt: -1 });
    res.json(consignments);
  } catch (err) {
    fail(res, err);
  }
});

// Get all applications (admin review queue)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const consignments = await Consignment.find()
      .populate('owner', 'name email phone address')
      .populate('linkedCar')
      .sort({ createdAt: -1 });
    res.json(consignments);
  } catch (err) {
    fail(res, err);
  }
});

// What each consignor's vehicles have earned, and what we kept for running
// them.
//
// Computed here rather than in the browser because the alternative is the
// admin page pulling every booking ever made — client, vehicle and driver
// populated — to add up a dozen rows. The split itself comes from
// utils/revenueShare.js, the same file the consignor's own dashboard uses,
// so the two sides cannot quote different figures at each other.
//
// Confirmed and completed only: a pending booking has not been agreed to
// and a cancelled one earned nobody anything.
router.get('/income', protect, adminOnly, async (req, res) => {
  try {
    const { from, to } = req.query;
    const span = {};
    if (from && !Number.isNaN(Date.parse(from))) span.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) span.$lte = new Date(to);

    const cars = await Car.find({ owner: { $ne: null } })
      // The register draws each vehicle as a card, not a row in a table, so
      // it needs what a card shows: what kind of vehicle, what it rents for,
      // and whether it is on the platform at all.
      .select('brand model plateNumber category pricePerDay isAvailable owner archived')
      .populate('owner', 'name email phone')
      .lean();
    if (!cars.length) return res.json([]);

    const bookings = await Booking.find({
      car: { $in: cars.map((c) => c._id) },
      status: { $in: ['confirmed', 'completed'] },
      ...(Object.keys(span).length ? { createdAt: span } : {}),
    })
      .select('car subtotal totalPrice ownerShare')
      .lean();

    const byCar = new Map(cars.map((c) => [String(c._id), []]));
    for (const b of bookings) byCar.get(String(b.car))?.push(b);

    // Grouped by consignor rather than by vehicle: one of them can have
    // several, and what they are owed is a single number across the lot.
    const byConsignor = new Map();
    for (const car of cars) {
      const id = String(car.owner?._id || car.owner);
      if (!byConsignor.has(id)) {
        byConsignor.set(id, {
          consignor: {
            id,
            name: car.owner?.name || 'Unknown',
            email: car.owner?.email || '',
            phone: car.owner?.phone || '',
          },
          rental: 0,
          ownerEarned: 0,
          weKept: 0,
          trips: 0,
          vehicles: [],
        });
      }
      const row = byConsignor.get(id);
      const totals = sumSplit(byCar.get(String(car._id)) || []);
      row.vehicles.push({
        id: String(car._id),
        name: `${car.brand} ${car.model}`,
        plateNumber: car.plateNumber || '',
        category: car.category || '',
        pricePerDay: car.pricePerDay || 0,
        // On the platform, or taken off it at the owner's request. The other
        // reasons a vehicle cannot go out — off the road, papers lapsed —
        // are not this question and are not asked here.
        onPlatform: car.isAvailable !== false,
        archived: !!car.archived,
        rental: totals.base,
        ownerEarned: totals.owner,
        weKept: totals.operator,
        trips: totals.count,
      });
      row.rental += totals.base;
      row.ownerEarned += totals.owner;
      row.weKept += totals.operator;
      row.trips += totals.count;
    }

    const list = [...byConsignor.values()];
    for (const row of list) row.vehicles.sort((a, b) => b.rental - a.rental);
    res.json(list.sort((a, b) => b.rental - a.rental));
  } catch (err) {
    fail(res, err);
  }
});

// Admin approves or declines an application.
// On approve: creates a live Car listing from the submitted vehicle data.
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { decision, adminNotes, pricePerDay } = req.body;
    let agreedPrice = NaN;

    // Only the two real answers.
    //
    // Nothing checked this before, and the notification below sends the
    // DECLINED message for anything that is not 'approved' — so a request
    // that left the decision out, or misspelt it, told an owner their
    // application had been turned down when nobody had turned it down.
    if (decision !== 'approved' && decision !== 'declined') {
      return res.status(400).json({ message: 'Say whether this application is approved or declined.' });
    }

    const consignment = await Consignment.findById(req.params.id);
    if (!consignment) return res.status(404).json({ message: 'Application not found' });

    if (consignment.status !== 'pending') {
      return res.status(400).json({ message: 'This application has already been reviewed.' });
    }

    if (decision === 'approved') {
      // Listing a vehicle for somebody whose contract is paused would put
      // it straight on sale for an owner we are not currently trading with.
      // Booking the inspection that starts all this already refuses while a
      // contract is on hold; approving the application at the end of it did
      // not, so the hold could be waited out rather than lifted.
      const owner = await User.findById(consignment.owner).select('suspension isBlocked name');
      if (!owner) return res.status(400).json({ message: 'That owner no longer has an account.' });
      if (owner.suspension?.at) {
        return res.status(400).json({
          message: `${owner.name}'s contract is on hold, so their vehicle cannot be listed. Lift the hold first, or decline this application.`,
        });
      }
      if (owner.isBlocked) {
        return res.status(400).json({ message: `${owner.name}'s account is blocked, so their vehicle cannot be listed.` });
      }

      // The same refusal Add Vehicle and the Edit drawer give. This route
      // creates vehicles too and was simply missed when the guard went in,
      // which is how a Nissan Almera came to be listed on the plate a
      // Toyota Avanza was already carrying. See utils/plates.js.
      const taken = plateClash(
        consignment.plateNumber,
        await Car.find().select('brand model plateNumber archived').lean(),
      );
      if (taken) return res.status(400).json({ message: plateClashMessage(taken) });

      // The daily rate is settled here, not taken on trust.
      //
      // What the consignor entered is a SUGGESTION — the field is called
      // that — but approving used to copy it to the live price unread, so a
      // Toyota Vios offered at ₱118 a day went on sale at ₱118 and had to be
      // corrected by hand afterwards. The price is a term of the deal, like
      // the split, so it is agreed rather than declared.
      //
      // Admin sends the figure they have agreed; leaving it out keeps the
      // suggestion, which is the old behaviour and fine when the suggestion
      // is what was agreed.
      // Start from what they suggested, so sending no price keeps the old
      // behaviour — right whenever the suggestion is what was agreed.
      agreedPrice = Number(consignment.suggestedPricePerDay);
      if (pricePerDay !== undefined) {
        const asked = Number(pricePerDay);
        if (!Number.isFinite(asked) || asked <= 0) {
          return res.status(400).json({ message: 'Give the daily rate this vehicle will be listed at.' });
        }
        agreedPrice = Math.round(asked);
      }
      if (!Number.isFinite(agreedPrice) || agreedPrice <= 0) {
        return res.status(400).json({
          message: 'This application has no usable daily rate. Set the rate you are listing it at before approving.',
        });
      }
    }

    consignment.status = decision;
    consignment.adminNotes = adminNotes || '';

    if (decision === 'approved') {
      const car = await Car.create({
        brand: consignment.brand,
        model: consignment.model,
        year: consignment.year,
        pricePerDay: agreedPrice,
        category: consignment.category,
        transmission: consignment.transmission,
        fuelType: consignment.fuelType,
        seats: consignment.seats,
        description: consignment.description,
        plateNumber: consignment.plateNumber || '',
        registrationExpiry: consignment.registrationExpiry,
        color: consignment.color || '',
        mileage: consignment.mileage,
        image: consignment.vehiclePhotos?.[0]?.url || '',
        imageFileId: consignment.vehiclePhotos?.[0]?.fileId || '',
        photos: consignment.vehiclePhotos || [],
        isAvailable: true,
        owner: consignment.owner,
        availableBookingTypes: consignment.availableBookingTypes?.length ? consignment.availableBookingTypes : ['self-drive', 'with-driver']
      });
      consignment.linkedCar = car._id;
    }

    await consignment.save();

    if (decision === 'approved') {
      await notifyUser(consignment.owner, 'Application Approved', `Your vehicle application for ${consignment.brand} ${consignment.model} has been approved and is now live.`, '/consignor');
    } else {
      await notifyUser(consignment.owner, 'Application Declined', `Your vehicle application for ${consignment.brand} ${consignment.model} was declined.${adminNotes ? ` Reason: ${adminNotes}` : ''}`, '/consignor');
    }

    res.json(consignment);
  } catch (err) {
    fail(res, err);
  }
});

export default router;
