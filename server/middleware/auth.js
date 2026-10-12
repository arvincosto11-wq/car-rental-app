import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
};

export const consignorOnly = (req, res, next) => {
  if (req.user.role !== 'consignor') {
    return res.status(403).json({ message: 'Consignor access only' });
  }
  next();
};

// Checks the account is still in good standing, in the database, now.
//
// Everything else here reads the token, which is signed and cannot be
// forged — but it is also a week old at worst, and it says what was true
// when somebody logged in. Suspend an owner and their browser keeps
// showing a token that says "consignor, allowed" until it expires, which
// would be a suspend button that suspends nobody for up to seven days.
//
// So this one costs a database read. It is used on the routes where a
// suspended owner must actually be stopped — the ones that start new
// business — and not on reads, so somebody on hold can still sign in, see
// their vehicles and read why. That is the whole point of putting them on
// hold rather than locking them out.
export const activeAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('suspension isBlocked role');
    if (!user) return res.status(401).json({ message: 'Not authorized' });
    if (user.suspension?.at) {
      return res.status(403).json({
        message: 'Your contract is on hold, so this cannot be done at the moment. Please call us on 0950-651-0479.',
      });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const adminOrConsignor = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'consignor') {
    return res.status(403).json({ message: 'Admin or consignor access only' });
  }
  next();
};