import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import useModalA11y from '../hooks/useModalA11y';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import api from '../api';
import { ImageIcon, InfoIcon, MailIcon, PhoneIcon, PinIcon, CloseIcon, TickIcon } from './adminConsignIcons';

// Deciding on one application.
//
// It used to be a modal that opened on a wall of specifications with the
// actual decision — approve, and at what price — pushed to the bottom. The
// decision is the reason the screen exists, so it now sits at the top in a
// card of its own, and the specifications are below it for whoever wants to
// check one.
//
// The rate is the part that matters most. What the owner entered is a
// SUGGESTION; approving used to copy it to the live price unread, which is
// how a vehicle offered at ₱118 a day went on sale at ₱118. So the figure is
// typed here, against a running line showing what the owner earns and what
// we keep at that rate.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;
const firstNameOf = (name) => String(name || '').trim().split(/\s+/)[0] || 'The owner';

const ConsignmentDrawer = ({ application: a, ownerPercent, onClose, onDecided }) => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [rate, setRate] = useState(a.suggestedPricePerDay ? String(a.suggestedPricePerDay) : '');
  const [mode, setMode] = useState('decide');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  const panelRef = useModalA11y(onClose, true);

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const red = isDark ? '#f28b82' : '#b91c1c';
  const blue = isDark ? '#8ab4f8' : '#1d4ed8';
  const blueSoft = isDark ? 'rgba(138,180,248,0.13)' : '#eaf0fd';

  const asked = Number(String(rate).replace(/\D/g, '')) || 0;
  const suggested = Number(a.suggestedPricePerDay) || 0;
  const ownerDay = Math.round(asked * (ownerPercent / 100));
  const first = firstNameOf(a.owner?.name);

  const suggestionLine = !suggested
    ? `${first} did not suggest a rate.`
    : asked === suggested
      ? `${first} suggested ${peso(suggested)}. It's only a suggestion.`
      : asked > suggested
        ? `${peso(asked - suggested)} above ${first}'s suggestion of ${peso(suggested)}.`
        : `${peso(suggested - asked)} below ${first}'s suggestion of ${peso(suggested)}.`;

  const approve = async () => {
    if (asked <= 0) return toast.error('Set the daily rate this vehicle will be listed at.');
    setWorking(true);
    try {
      await api.put(`/consignments/${a._id}`, { decision: 'approved', pricePerDay: asked });
      onDecided(`Approved · listed at ${peso(asked)} a day.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong approving this application.');
    } finally {
      setWorking(false);
    }
  };

  const sendDecline = async () => {
    if (!reason.trim()) return toast.error(`Give a reason — ${first} will see it.`);
    setWorking(true);
    try {
      await api.put(`/consignments/${a._id}`, { decision: 'declined', adminNotes: reason.trim() });
      onDecided(`Declined · ${first} will see your reason.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong declining this application.');
    } finally {
      setWorking(false);
    }
  };

  const photos = a.vehiclePhotos || [];
  const facts = [
    ['Plate', a.plateNumber || '—'],
    ['Colour', a.color || '—'],
    ['Mileage', a.mileage ? `${Number(a.mileage).toLocaleString()} km` : '—'],
    ['Category', a.category || '—'],
    ['Transmission', a.transmission || '—'],
    ['Fuel type', a.fuelType || '—'],
    ['Seats', a.seats ?? '—'],
    ['Suggested price', suggested ? `${peso(suggested)} a day` : '—'],
    ['Booking types', (a.availableBookingTypes?.length ? a.availableBookingTypes : ['self-drive', 'with-driver'])
      .map((t) => (t === 'self-drive' ? 'Self Drive' : 'With Driver')).join(' + ')],
  ];
  const contact = [
    { kind: 'email', value: a.owner?.email },
    { kind: 'phone', value: a.owner?.phone },
    { kind: 'address', value: a.owner?.address },
  ].filter((c) => c.value);

  const btn = {
    minHeight: '48px', padding: '0 18px', borderRadius: '10px',
    fontFamily: 'inherit', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  };

  const s = {
    backdrop: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,10,12,0.5)' },
    panel: {
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1001, width: '580px', maxWidth: '100vw',
      background: card, display: 'flex', flexDirection: 'column',
      boxShadow: '-20px 0 60px rgba(0,0,0,0.25)',
    },
    head: {
      flex: 'none', display: 'flex', gap: '12px', alignItems: 'flex-start',
      padding: '20px 24px 16px', borderBottom: `1px solid ${line}`,
    },
    chipBlue: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '3px 10px', borderRadius: '999px',
      fontSize: '12px', fontWeight: '700', background: blueSoft, color: blue,
    },
    applied: { fontSize: '12px', color: text3 },
    title: { margin: '6px 0 0', fontSize: '22px', fontWeight: '800', color: text },
    from: { color: text2 },
    close: {
      width: '44px', height: '44px', margin: '-8px -12px 0 0', border: 0, borderRadius: '10px',
      background: 'transparent', color: text2, display: 'grid', placeItems: 'center', cursor: 'pointer',
    },
    body: {
      flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 24px 28px',
      display: 'flex', flexDirection: 'column', gap: '20px',
    },

    photoGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '96px 96px', gap: '8px' },
    photoBig: { gridRow: 'span 2', borderRadius: '12px', overflow: 'hidden', background: inset, border: `1px solid ${line}` },
    photoSmall: { borderRadius: '12px', overflow: 'hidden', background: inset, border: `1px solid ${line}`, position: 'relative' },
    photoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    photoEmpty: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '6px',
      color: text3, fontSize: '12px', border: `1px dashed ${line}`, borderRadius: '12px', boxSizing: 'border-box',
    },
    photoMore: {
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      background: 'rgba(10,10,12,0.55)', color: '#fff', fontWeight: '750', fontSize: '15px',
    },

    decision: {
      display: 'flex', flexDirection: 'column', gap: '12px',
      padding: '18px', borderRadius: '14px', border: `1.5px solid ${gold}`,
    },
    decisionTitle: { fontWeight: '750', fontSize: '15px', color: text },
    rateRow: {
      display: 'flex', alignItems: 'center', gap: '8px', height: '52px', padding: '0 14px',
      borderRadius: '10px', border: `1px solid ${line}`, background: inset,
    },
    ratePeso: { fontWeight: '700', color: text2, fontSize: '18px' },
    rateInput: {
      flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent',
      color: text, fontFamily: 'inherit', fontSize: '24px', fontWeight: '800',
      fontVariantNumeric: 'tabular-nums',
    },
    rateUnit: { color: text3 },
    rateNotes: { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', color: text },
    rateSuggest: { color: text2 },
    rateStrongUs: { color: ink },
    row: { display: 'flex', gap: '10px' },
    btnGold: { ...btn, flex: 1, border: `1px solid ${gold}`, background: gold, color: ON_GOLD },
    btnLine: { ...btn, border: `1px solid ${line}`, background: card, color: text },
    btnRed: { ...btn, flex: 1, border: `1px solid ${red}`, background: red, color: isDark ? '#1a1a1a' : '#fff' },
    reasonLabel: { fontSize: '13px', fontWeight: '650', color: text },
    textarea: {
      width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
      border: `1px solid ${line}`, background: card, color: text,
      fontFamily: 'inherit', fontSize: '14px', resize: 'vertical',
    },

    info: {
      display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '12px',
      background: blueSoft, color: text, fontSize: '13px',
    },
    infoIcon: { flex: 'none', marginTop: '1px', color: blue },
    infoStrong: { color: blue },

    eyebrow: { fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', color: text3 },
    factGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 16px' },
    factKey: { fontSize: '12px', color: text3 },
    factValue: { fontWeight: '650', color: text, wordBreak: 'break-word' },
    desc: { margin: 0, lineHeight: 1.55, textWrap: 'pretty', color: text },
    contactRow: { display: 'flex', gap: '10px', alignItems: 'center', color: text },
    contactIcon: { flex: 'none', color: text3 },
    block: { display: 'flex', flexDirection: 'column', gap: '10px' },
  };

  return (
    <>
      <div style={s.backdrop} onClick={onClose} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Application for ${a.brand} ${a.model}`}
        style={s.panel}
      >
        <div style={s.head}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={s.chipBlue}>Waiting</span>
              <span style={s.applied}>
                Applied {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h2 style={s.title}>{a.brand} {a.model} · {a.year}</h2>
            <div style={s.from}>From {a.owner?.name || 'Unknown'}</div>
          </div>
          <button type="button" aria-label="Close" style={s.close} onClick={onClose}><CloseIcon size={18} /></button>
        </div>

        <div style={s.body}>
          {photos.length > 0 ? (
            <div style={s.photoGrid}>
              <div style={s.photoBig}>
                <img src={photos[0].url} alt="" style={s.photoImg} />
              </div>
              {[1, 2].map((i) => (
                <div key={i} style={s.photoSmall}>
                  {photos[i] ? <img src={photos[i].url} alt="" style={s.photoImg} /> : <div style={s.photoEmpty} />}
                  {i === 2 && photos.length > 3 && <span style={s.photoMore}>+{photos.length - 3}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...s.photoEmpty, height: '120px' }}>
              <ImageIcon size={22} />
              No photos were sent with this application.
            </div>
          )}

          <div style={s.decision}>
            <div style={s.decisionTitle}>List it at</div>
            <div style={s.rateRow}>
              <span style={s.ratePeso}>₱</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Daily rate"
                value={rate}
                disabled={working}
                onChange={(e) => setRate(e.target.value.replace(/\D/g, '').slice(0, 7))}
                style={s.rateInput}
              />
              <span style={s.rateUnit}>a day</span>
            </div>

            <div style={s.rateNotes}>
              <span style={s.rateSuggest}>{suggestionLine}</span>
              {asked > 0 && (
                <span>
                  At this rate {first} earns <b>{peso(ownerDay)}</b> a day and we keep{' '}
                  <b style={s.rateStrongUs}>{peso(asked - ownerDay)}</b>{' '}
                  ({ownerPercent}/{100 - ownerPercent}, new agreements).
                </span>
              )}
            </div>

            {mode === 'decide' && (
              <div style={s.row}>
                <button type="button" style={s.btnGold} disabled={working} onClick={approve}>
                  {working ? 'Working…' : `Approve and list at ${peso(asked)}`}
                </button>
                <button type="button" style={s.btnLine} disabled={working} onClick={() => setMode('declining')}>
                  Decline
                </button>
              </div>
            )}

            {mode === 'declining' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={s.reasonLabel} htmlFor="decline-reason">
                  Reason for declining · {first} will see this
                </label>
                <textarea
                  id="decline-reason"
                  rows={3}
                  style={s.textarea}
                  placeholder="e.g. We already list two of these for the same dates."
                  value={reason}
                  disabled={working}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div style={s.row}>
                  <button type="button" style={s.btnRed} disabled={working || !reason.trim()} onClick={sendDecline}>
                    {working ? 'Working…' : 'Send decline'}
                  </button>
                  <button type="button" style={s.btnLine} disabled={working} onClick={() => setMode('decide')}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={s.info}>
            <span style={s.infoIcon}><InfoIcon size={18} /></span>
            <div>
              <b style={s.infoStrong}>Papers checked in person.</b> The OR and CR are checked at the
              counter, not uploaded here.
            </div>
          </div>

          <div style={s.block}>
            <div style={s.eyebrow}>VEHICLE</div>
            <div style={s.factGrid}>
              {facts.map(([k, v]) => (
                <div key={k}>
                  <div style={s.factKey}>{k}</div>
                  <div style={s.factValue}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {a.description && (
            <div style={{ ...s.block, gap: '6px' }}>
              <div style={s.eyebrow}>FROM THE OWNER</div>
              <p style={s.desc}>{a.description}</p>
            </div>
          )}

          {contact.length > 0 && (
            <div style={{ ...s.block, gap: '8px' }}>
              <div style={s.eyebrow}>OWNER</div>
              {contact.map((c) => (
                <div key={c.kind} style={s.contactRow}>
                  <span style={s.contactIcon}>
                    {c.kind === 'email' && <MailIcon size={16} />}
                    {c.kind === 'phone' && <PhoneIcon size={16} />}
                    {c.kind === 'address' && <PinIcon size={16} />}
                  </span>
                  {c.value}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default ConsignmentDrawer;
