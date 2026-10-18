import { useState, useEffect } from 'react';
import api from '../api';

// The rating itself, with no opinion about what it sits inside.
//
// It is asked for in two places — inside a booking on My Bookings, and on
// the Rate My Bookings page — and the two used to be the same modal. Now
// one of them is an inline panel, so the form lives here and each caller
// supplies its own surround. Splitting it this way is what stops the
// three scores, the photos and the driver from quietly going missing from
// whichever copy somebody forgets to update.

const uploadToImageKit = async (file) => {
  const authRes = await api.get('/imagekit/user-auth');
  const { token, expire, signature, publicKey } = authRes.data;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', file.name);
  formData.append('token', token);
  formData.append('expire', expire);
  formData.append('signature', signature);
  formData.append('publicKey', publicKey);
  const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
  const data = await uploadRes.json();
  return { url: data.url, fileId: data.fileId };
};

export const SCORES = [
  { key: 'vehicleCondition', label: 'Vehicle condition' },
  { key: 'serviceQuality', label: 'Service quality' },
  { key: 'cleanliness', label: 'Cleanliness' },
];

export function useRatingForm(booking) {
  const [form, setForm] = useState({ vehicleCondition: 0, serviceQuality: 0, cleanliness: 0, comment: '' });
  // Kept apart from the vehicle's scores because it is optional and they
  // are not: 0 here means "said nothing about the driver", which is a
  // perfectly good answer and must not read as one star.
  const [driverScore, setDriverScore] = useState(0);
  const [driverComment, setDriverComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bookingId = booking?._id;
  useEffect(() => {
    if (!booking) return;
    setForm({
      vehicleCondition: booking.carRating?.vehicleCondition || 0,
      serviceQuality: booking.carRating?.serviceQuality || 0,
      cleanliness: booking.carRating?.cleanliness || 0,
      comment: booking.carRating?.comment || '',
    });
    setPhotos((booking.carRating?.photos || []).map((p) => ({ id: p.url, url: p.url, fileId: p.fileId })));
    setDriverScore(booking.driverRating?.rating || 0);
    setDriverComment(booking.driverRating?.comment || '');
    setError('');
    // Keyed on the booking's id, not the object: the list re-renders on
    // every poll, and depending on the object would wipe what somebody is
    // halfway through typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const addPhotos = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setPhotos((prev) => [
      ...prev,
      ...files.map((file) => ({ id: URL.createObjectURL(file), file, preview: URL.createObjectURL(file) })),
    ]);
  };
  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  // All three, because an average built from a missing score is not an
  // average of anything.
  const ready = !!(form.vehicleCondition && form.serviceQuality && form.cleanliness);

  const submit = async (onSubmitted) => {
    if (!ready) {
      setError('Please rate all three.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const uploadedPhotos = [];
      for (const p of photos) {
        if (p.file) uploadedPhotos.push(await uploadToImageKit(p.file));
        else uploadedPhotos.push({ url: p.url, fileId: p.fileId });
      }
      const res = await api.post(`/bookings/${booking._id}/rate-car`, {
        vehicleCondition: form.vehicleCondition,
        serviceQuality: form.serviceQuality,
        cleanliness: form.cleanliness,
        comment: form.comment,
        photos: uploadedPhotos,
        // Left out entirely when they said nothing, so the server never
        // records a rating nobody gave.
        ...(driverScore ? { driverRating: driverScore, driverComment } : {}),
      });
      onSubmitted(res.data.carRating, driverScore ? { rating: driverScore, comment: driverComment } : null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send that rating.');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    form, setForm, driverScore, setDriverScore, driverComment, setDriverComment,
    photos, addPhotos, removePhoto, error, setError, submitting, ready, submit,
  };
}
