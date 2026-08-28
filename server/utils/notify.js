import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Fire-and-forget notification helpers used by other routes when a status
// change or decision happens that the affected user should know about.

export const notifyUser = async (userId, title, message, link = '') => {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, title, message, link });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

export const notifyAdmins = async (title, message, link = '') => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (admins.length) {
      await Notification.insertMany(admins.map((a) => ({ user: a._id, title, message, link })));
    }
  } catch (err) {
    console.error('Failed to create admin notifications:', err.message);
  }
};
