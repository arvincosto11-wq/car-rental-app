import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, goldInk } from '../theme';
import { daysWaiting } from '../utils/payouts';

// Where the money stands right now: handed over, owed, and on its way.
//
// None of these three follow the period tabs further down the page, and
// that is deliberate. What we owe is what we owe — an unpaid trip from
// August is still owed in November — so putting it behind "This month"
// would be a figure that quietly changes meaning.
//
// Coming is drawn in stripes rather than a colour. It is the one number
// here that is not money anybody can act on yet: the trip has been booked
// and paid for but not travelled, and a booking can still be cancelled and
// refunded. A flat tile would have put it on the same footing as the other
// two.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

const PayoutSummary = ({ rows }) => {
  const { isDark } = useTheme();

  const totals = rows.reduce((acc, r) => ({
    paid: acc.paid + r.paidAllTime,
    owed: acc.owed + r.owed,
    coming: acc.coming + r.coming,
    trips: acc.trips + r.payable.length,
  }), { paid: 0, owed: 0, coming: 0, trips: 0 });

  const owing = rows.filter((r) => r.owed > 0);
  const oldest = owing
    .map((r) => r.oldestUnpaidAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b))[0];

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const green = isDark ? '#6fcf8f' : '#15803d';

  const s = {
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '16px', marginBottom: '20px',
    },
    card: {
      padding: '16px 20px', borderRadius: '14px', background: card,
      border: `1px solid ${line}`, display: 'flex', gap: '12px',
    },
    dot: (fill) => ({
      flex: 'none', width: '10px', height: '10px', borderRadius: '999px',
      marginTop: '5px', background: fill,
    }),
    label: { fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', color: text3 },
    value: (tone) => ({
      fontSize: '22px', fontWeight: '800', marginTop: '2px',
      fontVariantNumeric: 'tabular-nums',
      color: tone === 'gold' ? ink : tone === 'quiet' ? text2 : text,
    }),
    sub: { fontSize: '12px', color: text3, textWrap: 'pretty' },
  };

  // The same stripe the Coming figure is dotted with, so the two read as
  // one idea rather than as a tile that failed to load.
  const stripes = `repeating-linear-gradient(45deg, ${line} 0 5px, ${inset} 5px 10px)`;

  const waited = oldest ? daysWaiting(oldest) : 0;

  return (
    <div style={s.grid}>
      <div style={s.card}>
        <span style={s.dot(green)} aria-hidden="true" />
        <div>
          <div style={s.label}>PAID OUT</div>
          <div style={s.value()}>{peso(totals.paid)}</div>
          <div style={s.sub}>handed over all time</div>
        </div>
      </div>

      <div style={s.card}>
        <span style={s.dot(gold)} aria-hidden="true" />
        <div>
          <div style={s.label}>OWED RIGHT NOW</div>
          <div style={s.value('gold')}>{peso(totals.owed)}</div>
          <div style={s.sub}>
            {totals.owed === 0
              ? 'nobody waiting'
              : `${totals.trips} finished trip${totals.trips === 1 ? '' : 's'}`
                + ` · to ${owing.length} owner${owing.length === 1 ? '' : 's'}`
                + ` · oldest ${waited} day${waited === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      <div style={s.card}>
        <span style={{ ...s.dot(line), background: stripes }} aria-hidden="true" />
        <div>
          <div style={s.label}>COMING</div>
          <div style={s.value('quiet')}>{peso(totals.coming)}</div>
          <div style={s.sub}>booked, not yet travelled</div>
        </div>
      </div>
    </div>
  );
};

export default PayoutSummary;
