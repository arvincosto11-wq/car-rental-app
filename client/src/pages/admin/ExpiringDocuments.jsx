import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonListCard } from '../../components/Skeleton';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, goldInk } from '../../theme';
import { phYmd } from '../../utils/phTime';
import api from '../../api';

// Days between two Philippine calendar days. Counted as days on a
// calendar, never as 24-hour blocks: papers expiring on the 31st are good
// for the whole of the 31st, whatever the clock says.
const daysApart = (fromYmd, toYmd) => Math.round(
  (new Date(`${toYmd}T00:00:00Z`) - new Date(`${fromYmd}T00:00:00Z`)) / 86400000,
);

const fmtDay = (iso) => new Date(`${phYmd(iso)}T00:00:00Z`).toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
});
const fmtShort = (iso) => new Date(`${phYmd(iso)}T00:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The window the page covers: a week behind, so lapsed vehicles stay in
// sight, and the thirty days the list itself is built from.
const BACK = 7;
const AHEAD = 30;
const SPAN = BACK + AHEAD;

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.4" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
  </svg>
);
const TickIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" /><path d="M5.5 8.2l1.7 1.7 3.3-3.6" />
  </svg>
);
const BigTickIcon = () => (
  <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);

const ExpiringDocuments = () => {
  usePageTitle('Expiring Documents');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => phYmd(new Date()));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/admin/expiring-documents');
        setRows(res.data.registrations || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const page = isDark ? '#18191a' : '#f4f5f6';
  const card = isDark ? '#242526' : '#ffffff';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const chip = isDark ? '#303132' : '#f1f2f4';
  const amber = isDark ? '#fbbf24' : '#92400e';
  const amberBg = isDark ? 'rgba(217,119,6,0.16)' : '#fef3c7';
  const amberF = isDark ? '#f59e0b' : '#d97706';
  const green = isDark ? '#4ade80' : '#15803d';
  const greenBg = isDark ? 'rgba(34,197,94,0.14)' : '#dcfce7';
  // Amber hatching is what lapsed papers look like everywhere in the
  // admin. Red appears nowhere on this page: this is a job to do.
  const hatch = isDark
    ? 'repeating-linear-gradient(135deg, rgba(245,158,11,0.6) 0 4px, rgba(245,158,11,0.14) 4px 8px)'
    : 'repeating-linear-gradient(135deg, #f5c56b 0 4px, #fef3c7 4px 8px)';
  const hatchSoft = isDark
    ? 'repeating-linear-gradient(135deg, rgba(245,158,11,0.10) 0 6px, transparent 6px 12px)'
    : 'repeating-linear-gradient(135deg, rgba(217,119,6,0.10) 0 6px, transparent 6px 12px)';

  // ── the rows, with everything the page says about each ──────────────
  const vehicles = rows.map((r) => {
    const expiry = phYmd(r.expiry);
    const d = daysApart(today, expiry);
    const lapsed = d < 0;
    const risk = r.risk || null;
    const riskLine = !risk ? '' : {
      before_pickup: `Confirmed booking ${fmtShort(risk.start)} – ${fmtShort(risk.end)}, renew before pickup`,
      runs_past: `Confirmed booking ${fmtShort(risk.start)} – ${fmtShort(risk.end)} runs past the expiry`,
      starts_after: `Confirmed booking ${fmtShort(risk.start)} – ${fmtShort(risk.end)} starts after the expiry`,
    }[risk.kind] || '';
    return {
      id: r.carId,
      name: `${r.brand} ${r.model}`,
      plate: r.plateNumber || 'No plate on file',
      owner: r.ownerName ? `Consignor · ${r.ownerName}` : null,
      expiry,
      days: d,
      lapsed,
      risk: riskLine,
      dateLabel: fmtDay(r.expiry),
      relative: lapsed
        ? (d === -1 ? 'Lapsed yesterday' : `Lapsed ${-d} days ago`)
        : (d === 0 ? 'Lapses today' : `In ${plural(d, 'day')}`),
      consequence: lapsed
        ? 'Off the road. Can’t be booked until renewed.'
        : `Takes bookings until ${fmtDay(r.expiry)}. Trips that run past it are refused.`,
    };
  }).sort((a, b) => a.days - b.days);

  const lapsedOnes = vehicles.filter((v) => v.lapsed);
  const upcoming = vehicles.filter((v) => !v.lapsed);
  const atRisk = vehicles.filter((v) => v.risk).length;
  const upcomingDates = [...new Set(upcoming.map((v) => v.days))];

  const summaryMain = lapsedOnes.length
    ? `${plural(lapsedOnes.length, 'vehicle')} can’t be booked until ${lapsedOnes.length === 1 ? 'its' : 'their'} papers are renewed.`
    : `${plural(upcoming.length, 'vehicle')} to renew in the next 30 days.`;

  const summarySub = !upcoming.length
    ? 'Nothing else lapses in the next 30 days.'
    : upcomingDates.length === 1
      ? `${lapsedOnes.length ? `${upcoming.length} more` : (upcoming.length === 1 ? 'It' : 'All')} lapse${upcoming.length === 1 && !lapsedOnes.length ? 's' : ''} on ${upcoming[0].dateLabel}, in ${plural(upcoming[0].days, 'day')}. Until then they take bookings, but not trips that run past it.`
      : `${upcoming.length} more lapse in the next 30 days, the first on ${upcoming[0].dateLabel}.`;

  // ── the timeline ────────────────────────────────────────────────────
  const at = (days) => `${((Math.max(-BACK, Math.min(AHEAD, days)) + BACK) / SPAN) * 100}%`;
  const stacks = [...new Set(vehicles.map((v) => v.days))].map((days) => {
    const here = vehicles.filter((v) => v.days === days);
    return {
      days,
      left: at(days),
      // Lapsed stacks carry no label: the zone behind them is already
      // labelled, and two labels on top of each other read as neither.
      label: days < 0 ? '' : `${here.length > 1 ? `${here.length} · ` : ''}${fmtShort(here[0].expiry)}`,
      dots: here,
    };
  });
  const tickAt = (days, label, shift, strong) => ({ left: at(days), label, shift, strong });
  const dayFrom = (days) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };
  const ticks = [
    tickAt(-BACK, dayFrom(-BACK), '0', false),
    tickAt(0, 'Today', '-50%', true),
    tickAt(7, dayFrom(7), '-50%', false),
    tickAt(14, dayFrom(14), '-50%', false),
    tickAt(21, dayFrom(21), '-50%', false),
    tickAt(AHEAD, `${dayFrom(AHEAD)} · 30 days`, '-100%', false),
  ];

  // ── opening a vehicle ───────────────────────────────────────────────
  //
  // By id, never by plate: two vehicles here share a plate, and a third
  // has none at all.
  const openVehicle = (v) => navigate(
    `/admin/manage-cars?edit=${v.id}&focus=registrationExpiry&return=/admin/expiring-documents`,
  );

  // The row leans toward the pointer, like the sidebar. Written here
  // rather than in CSS because it follows the cursor.
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lean = (e) => {
    if (reduced) return;
    const box = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    const k = (Math.min(1, length / 40) * 3) / length;
    e.currentTarget.style.transform = `translate(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px)`;
  };
  const unlean = (e) => { e.currentTarget.style.transform = ''; };

  const s = {
    shell: { background: page, display: 'flex', flexDirection: 'column', gap: '24px' },
    title: { margin: 0, fontSize: '26px', fontWeight: '700', color: text },
    sub: { margin: '6px 0 0', fontSize: '14px', lineHeight: 1.5, color: text2 },

    summary: {
      display: 'flex', alignItems: 'center', gap: '18px', padding: '20px 24px',
      background: card, border: `1px solid ${line}`, borderRadius: '12px', flexWrap: 'wrap',
    },
    mark: (lapsedAny) => ({
      width: '44px', height: '44px', flexShrink: 0, borderRadius: '10px', boxSizing: 'border-box',
      background: lapsedAny ? hatch : goldTint,
      border: lapsedAny ? `1px solid ${amberF}` : 'none',
      color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }),
    summaryMain: { fontSize: '20px', fontWeight: '700', lineHeight: 1.3, color: text, textWrap: 'pretty' },
    summarySub: { fontSize: '14px', lineHeight: 1.5, color: text2, textWrap: 'pretty' },
    riskChip: (on) => ({
      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px',
      background: on ? amberBg : chip, color: on ? amber : text2,
      fontSize: '13px', fontWeight: on ? '700' : '600',
    }),

    section: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px',
      padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: '16px',
    },
    sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
    sectionTitle: { margin: 0, fontSize: '15px', fontWeight: '700', color: text },
    legend: { display: 'flex', gap: '16px', fontSize: '12px', color: text2 },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
    legendDot: (fill, border) => ({
      width: '12px', height: '12px', borderRadius: '50%', boxSizing: 'border-box',
      background: fill, border: `2px solid ${border}`,
    }),

    plot: { position: 'relative', height: '190px', margin: '0 8px' },
    zone: (width) => ({
      position: 'absolute', left: 0, top: 0, bottom: '30px', width,
      background: hatchSoft, borderRadius: '6px 0 0 6px',
    }),
    zoneLabel: { position: 'absolute', left: '8px', top: '8px', fontSize: '12px', fontWeight: '700', color: amber },
    axis: { position: 'absolute', left: 0, right: 0, bottom: '30px', height: '1px', background: line },
    todayLine: (left) => ({
      position: 'absolute', left, top: 0, bottom: '24px', width: '2px', marginLeft: '-1px', background: text,
    }),
    stack: (left) => ({
      position: 'absolute', left, bottom: '38px', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: '4px',
    }),
    dot: (v) => ({
      width: '16px', height: '16px', padding: 0, borderRadius: '50%', boxSizing: 'border-box',
      background: v.lapsed ? hatch : (v.risk ? amberF : gold),
      border: `2px solid ${v.lapsed || v.risk ? amberF : gold}`,
      cursor: 'pointer',
    }),
    stackLabel: { fontSize: '12px', fontWeight: '700', color: text, whiteSpace: 'nowrap', marginBottom: '2px' },
    tick: (t) => ({
      position: 'absolute', left: t.left, bottom: 0, transform: `translateX(${t.shift})`,
      fontSize: '12px', fontWeight: t.strong ? '800' : '500',
      color: t.strong ? text : text3, whiteSpace: 'nowrap',
    }),

    list: { background: card, border: `1px solid ${line}`, borderRadius: '12px', padding: '8px' },
    divider: {
      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
      fontSize: '12px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', color: text,
    },
    dividerRule: { flex: 1, height: '2px', background: text },
    row: {
      width: '100%', display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.1fr) 230px minmax(0, 1.5fr) 110px',
      gap: '20px', alignItems: 'center', padding: '14px 12px',
      border: 'none', borderRadius: '8px', background: 'transparent',
      textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit',
    },
    name: { fontSize: '15px', fontWeight: '600', color: text },
    plate: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: text3 },
    ownerChip: {
      padding: '1px 7px', borderRadius: '999px', border: `1px solid ${line}`,
      fontSize: '11px', fontWeight: '600', color: text2, whiteSpace: 'nowrap',
    },
    track: { height: '8px', borderRadius: '4px', background: chip, overflow: 'hidden', display: 'flex' },
    trackFill: (v) => ({
      width: v.lapsed ? '100%' : `${Math.max(4, ((AHEAD - v.days) / AHEAD) * 100)}%`,
      background: v.lapsed ? hatch : (v.risk ? amberF : gold),
      borderRadius: '4px',
    }),
    trackFoot: { display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' },
    relative: (v) => ({ fontWeight: '700', color: v.lapsed || v.risk ? amber : text2 }),
    consequence: { fontSize: '13px', lineHeight: 1.45, color: text2, textWrap: 'pretty' },
    riskLine: {
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '13px', fontWeight: '700', color: amber,
    },
    action: {
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px',
      fontSize: '13px', fontWeight: '700', color: ink,
    },

    empty: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px',
      padding: '64px 32px', background: card, border: `1px solid ${line}`, borderRadius: '12px',
    },
    emptyMark: {
      width: '56px', height: '56px', borderRadius: '50%', background: greenBg, color: green,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { margin: 0, fontSize: '22px', fontWeight: '700', color: text },
    emptyText: { margin: 0, maxWidth: '460px', fontSize: '14px', lineHeight: 1.6, color: text2, textWrap: 'pretty' },
    emptyWhen: { fontSize: '12px', color: text3 },
  };

  const todayLabel = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });

  const Row = ({ v }) => (
    <button
      type="button"
      className="doc-row"
      style={s.row}
      aria-label={`${v.name}, ${v.lapsed ? 'lapsed' : 'lapses'} ${v.dateLabel}. Edit registration expiry`}
      onClick={() => openVehicle(v)}
      onMouseMove={lean}
      onMouseLeave={unlean}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
        <span style={s.name}>{v.name}</span>
        <span style={s.plate}>
          {v.plate}
          {v.owner && <span style={s.ownerChip}>{v.owner}</span>}
        </span>
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={s.track}><span style={s.trackFill(v)} /></span>
        <span style={s.trackFoot}>
          <span style={s.relative(v)}>{v.relative}</span>
          <span style={{ color: text3 }}>{v.dateLabel}</span>
        </span>
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <span style={s.consequence}>{v.consequence}</span>
        {v.risk && <span style={s.riskLine}><CalendarIcon />{v.risk}</span>}
      </span>

      <span style={s.action}>Edit expiry<ChevronIcon /></span>
    </button>
  );

  return (
    <AdminLayout activePage="Expiring Documents">
      <div style={s.shell}>
        <div>
          <h1 style={s.title}>Expiring Documents</h1>
          <p style={s.sub}>
            Vehicle registrations (OR/CR) that have lapsed or lapse within 30 days.
            Open a vehicle to update its expiry date in Manage Cars.
          </p>
        </div>

        {loading ? (
          <SkeletonListCard isDark={isDark} count={3} />
        ) : vehicles.length === 0 ? (
          <div style={s.empty}>
            <span style={s.emptyMark}><BigTickIcon /></span>
            <h2 style={s.emptyTitle}>All papers are in date</h2>
            <p style={s.emptyText}>
              No vehicle&apos;s registration lapses in the next 30 days, so every listed vehicle
              can be booked. A vehicle shows up here 30 days before its expiry date.
            </p>
            <span style={s.emptyWhen}>Checked against today, {todayLabel}</span>
          </div>
        ) : (
          <>
            <div style={s.summary}>
              <span style={s.mark(lapsedOnes.length > 0)}>
                {lapsedOnes.length === 0 && <ClockIcon />}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <span style={s.summaryMain}>{summaryMain}</span>
                <span style={s.summarySub}>{summarySub}</span>
              </div>
              <span style={s.riskChip(atRisk > 0)}>
                {atRisk > 0 ? <CalendarIcon /> : <TickIcon />}
                {atRisk > 0 ? `${plural(atRisk, 'confirmed booking')} at risk` : 'No bookings at risk'}
              </span>
            </div>

            <section style={s.section}>
              <div style={s.sectionHead}>
                <h2 style={s.sectionTitle}>Last week to 30 days ahead</h2>
                <div style={s.legend}>
                  <span style={s.legendItem}><span style={s.legendDot(hatch, amberF)} />Lapsed</span>
                  <span style={s.legendItem}><span style={s.legendDot(amberF, amberF)} />Booking at risk</span>
                  <span style={s.legendItem}><span style={s.legendDot(gold, gold)} />Lapses soon</span>
                </div>
              </div>

              <div style={s.plot}>
                <div style={s.zone(at(0))} />
                {lapsedOnes.length > 0 && (
                  <span style={s.zoneLabel}>{lapsedOnes.length} off the road</span>
                )}
                <div style={s.axis} />
                <div style={s.todayLine(at(0))} />

                {stacks.map((stack) => (
                  <div key={stack.days} style={s.stack(stack.left)}>
                    {stack.dots.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="doc-dot"
                        style={s.dot(v)}
                        title={v.name}
                        aria-label={`${v.name}, ${v.lapsed ? 'lapsed' : 'lapses'} ${v.dateLabel}. Edit registration expiry`}
                        onClick={() => openVehicle(v)}
                      />
                    ))}
                    {stack.label && <span style={s.stackLabel}>{stack.label}</span>}
                  </div>
                ))}

                {ticks.map((t) => (
                  <span key={t.label + t.left} style={s.tick(t)}>{t.label}</span>
                ))}
              </div>
            </section>

            <section style={s.list}>
              {lapsedOnes.map((v) => <Row key={v.id} v={v} />)}
              <div style={s.divider}>
                <span>Today · {todayLabel}</span>
                <span style={s.dividerRule} />
              </div>
              {upcoming.map((v) => <Row key={v.id} v={v} />)}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default ExpiringDocuments;
