import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendNotificationEmail } from './email.js';

// Fire-and-forget notification helpers used by other routes when a status
// change or decision happens that the affected user should know about.

// `email: true` also sends it to the client's inbox. Deliberately opt-in
// per call rather than on everything: a message for every small change is
// how people learn to ignore the ones that matter. It is for the few that
// are worth knowing about away from the site — money moving, a booking
// being confirmed, a decision with a deadline on it.
//
// The email is always secondary. It is sent after the notification is
// safely stored, and a failure to send is logged and swallowed: a client
// must never lose the record of something because their mail provider was
// having a bad afternoon.
export const notifyUser = async (userId, title, message, link = '', { email = false } = {}) => {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, title, message, link });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }

  if (!email) return;
  try {
    const user = await User.findById(userId).select('email');
    if (user?.email) await sendNotificationEmail({ to: user.email, title, message, link });
  } catch (err) {
    console.error(`Failed to email notification "${title}":`, err.message);
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
