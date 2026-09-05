import { useTheme } from '../context/ThemeContext';
import usePageTitle from '../hooks/usePageTitle';

const FAQS = [
  {
    q: 'How do I book a vehicle?',
    a: 'Pick a car from Vehicles, click "Book Now", and follow the 3-step wizard: choose your pickup and return dates on the calendar, pick a booking type and payment option, then confirm. Your booking starts as "pending" until an admin confirms it.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'GCash, paid securely online through PayMongo at the time of booking. You can pay a 20% downpayment now and the rest (cash or GCash) on pickup, or pay in full upfront.',
  },
  {
    q: 'What is the cancellation and refund policy?',
    a: 'You can request a refund on any pending or confirmed booking from My Bookings, up until the vehicle is picked up. The amount depends on how long ago you booked, not your pickup date: cancel within 12 hours of booking for a full refund, within 12–24 hours for 50%, or after 24 hours for no refund. An admin needs to approve the request before it\'s finalized.',
  },
  {
    q: 'Can I change my booking dates without cancelling?',
    a: 'Yes — request a reschedule from My Bookings. It has to keep the same trip length (e.g. a 3-day booking moves to a different 3-day window) and needs admin approval, but there\'s no penalty fee like a cancellation has.',
  },
  {
    q: 'Do I need a driver\'s license?',
    a: 'Only for self-drive bookings. You can add your license number and expiry either from your Profile ahead of time, or right on the booking form when you self-drive-book — as long as it hasn\'t expired.',
  },
  {
    q: 'Why can\'t I book a car for certain dates?',
    a: 'Cars show a live availability calendar on their detail page — dates already taken by a confirmed booking are marked red and can\'t be selected. Everything else is fair game.',
  },
  {
    q: 'How do I list my own vehicle for rent?',
    a: 'Click "List Your Car" to submit a consignment application with your vehicle\'s details and photos. Once approved, you\'ll get a consignor account to track bookings and earnings for it.',
  },
  {
    q: 'How do I reach support?',
    a: 'Call 0950-651-0479, message us on Facebook (Rent-A-Ride Albay), or visit us in Salugan, Camalig, Albay. We\'re available 24/7.',
  },
];

const Help = () => {
  usePageTitle('Help & FAQ');
  const { isDark } = useTheme();

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '760px', margin: '0 auto', padding: '48px 32px' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '8px', textAlign: 'center' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '32px', textAlign: 'center' },
    item: {
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '10px',
      padding: '14px 18px',
      marginBottom: '10px',
    },
    question: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', cursor: 'pointer', listStyle: 'none' },
    answer: { fontSize: '13px', color: isDark ? '#94a3b8' : '#4b5563', lineHeight: '1.6', marginTop: '10px' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>Help &amp; FAQ</h1>
        <p style={s.subtitle}>Answers to the most common questions about booking, payments, and policies.</p>

        {FAQS.map((item, i) => (
          <details key={i} style={s.item}>
            <summary style={s.question}>{item.q}</summary>
            <p style={s.answer}>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
};

export default Help;
