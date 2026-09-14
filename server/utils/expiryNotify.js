import { notifyUser } from './notify.js';

const EXPIRY_WINDOW_DAYS = 30;
const RENOTIFY_COOLDOWN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const isDueOrOverdue = (lastNotifiedAt) =>
  !lastNotifiedAt || (Date.now() - new Date(lastNotifiedAt).getTime()) > RENOTIFY_COOLDOWN_DAYS * DAY_MS;

// Opportunistic reminder check — there's no cron/background worker in this
// app (Render's free tier won't reliably run one anyway), so this piggybacks
// on GET /auth/me instead, which fires on essentially every page load. Fire-
// and-forget: never let a notification failure break the caller's request.
export const checkAndNotifyExpiringDocs = async (user) => {
  try {
    const cutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * DAY_MS);
    let touched = false;

    if (user.validIdExpiry && user.validIdExpiry <= cutoff && isDueOrOverdue(user.idExpiryNotifiedAt)) {
      const expired = user.validIdExpiry < new Date();
      await notifyUser(
        user._id,
        expired ? 'Your Valid ID Has Expired' : 'Your Valid ID Is Expiring Soon',
        expired
          ? 'Your valid ID on file has expired. Please upload an updated ID in your Profile — you won’t be able to book until it’s renewed and re-verified.'
          : `Your valid ID on file expires on ${user.validIdExpiry.toLocaleDateString()}. Please upload an updated one in your Profile before it expires.`,
        '/profile'
      );
      user.idExpiryNotifiedAt = new Date();
      touched = true;
    }

    // License expiry only matters for plain clients (self-drive bookings) —
    // consignors and admins never need one on file.
    if (user.role === 'user' && user.licenseExpiry && user.licenseExpiry <= cutoff && isDueOrOverdue(user.licenseExpiryNotifiedAt)) {
      const expired = user.licenseExpiry < new Date();
      await notifyUser(
        user._id,
        expired ? 'Your Driver’s License Has Expired' : 'Your Driver’s License Is Expiring Soon',
        expired
          ? 'Your driver’s license on file has expired. Please update it in your Profile — you won’t be able to book self-drive until it’s renewed.'
          : `Your driver's license on file expires on ${user.licenseExpiry.toLocaleDateString()}. Please update it in your Profile before it expires.`,
        '/profile'
      );
      user.licenseExpiryNotifiedAt = new Date();
      touched = true;
    }

    // validateBeforeSave: false — this is called with a user doc fetched via
    // .select('-password') (GET /auth/me), so password isn't loaded and a
    // normal validated save would fail on the schema's required check for it.
    // We're only touching the two notified-at timestamps here.
    if (touched) await user.save({ validateBeforeSave: false });
  } catch (err) {
    console.error('Failed to check/notify expiring documents:', err.message);
  }
};
