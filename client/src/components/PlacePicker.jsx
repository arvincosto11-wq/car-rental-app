import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GOLD, GOLD_DARK, goldInk } from '../theme';
import { legQuote, deliveryRefusal } from '../utils/delivery';

// Same divIcon approach as the GPS map: Leaflet's default marker images
// don't resolve under Vite.
const dot = (color, size = 16) => L.divIcon({
  className: '',
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
});

const ClickCatcher = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
};

// Choosing where a vehicle is handed over, and saying what it costs before
// anybody pays.
//
// A map rather than a typed address, because an address needs a geocoding
// service — a paid key, an outgoing call per keystroke, and a dependency
// that can be down at checkout. A pin needs none of that: the distance is
// arithmetic on two coordinates. The trade is that a pin is not an address,
// so the client also writes where they actually mean in their own words,
// which is what the driver reads anyway.
//
// The quote shown here is the client's copy of the rule. The server
// recomputes it from the coordinates at booking time and its answer is the
// one charged — see routes/bookings.js.
const PlacePicker = ({ value, onChange, settings, isDark, label, describedBy }) => {
  const [open, setOpen] = useState(!!value);
  const base = settings?.base;
  const quote = legQuote(value, settings);
  const gold = isDark ? GOLD_DARK : GOLD;

  const s = {
    wrap: { marginTop: '8px' },
    choices: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    choice: (active) => ({
      flex: '1 1 160px', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${active ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : (isDark ? '#242526' : '#fff'),
      color: isDark ? '#e4e6eb' : '#1a1a1a', fontSize: '13px', fontWeight: '600',
    }),
    choiceSub: { display: 'block', fontSize: '11px', fontWeight: '500', marginTop: '2px', color: isDark ? '#b0b3b8' : '#6b7280' },
    map: {
      height: '200px', marginTop: '10px', borderRadius: '10px', overflow: 'hidden',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '6px' },
    input: {
      width: '100%', marginTop: '8px', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    quote: {
      marginTop: '8px', padding: '9px 12px', borderRadius: '8px', fontSize: '12px',
      background: isDark ? '#18191a' : '#f9fafb', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center',
    },
    fee: { fontWeight: '700', color: goldInk(isDark), whiteSpace: 'nowrap' },
    refusal: {
      marginTop: '8px', padding: '9px 12px', borderRadius: '8px', fontSize: '12px', lineHeight: 1.5,
      background: isDark ? '#3a2f10' : '#fff7e6', border: `1px solid ${isDark ? '#5a4a1a' : '#f3d98b'}`,
      color: isDark ? '#e8c463' : '#8a6d1a',
    },
  };

  const pickBase = () => { setOpen(false); onChange(null); };

  if (!settings?.enabled) {
    return (
      <p style={s.hint} id={describedBy}>
        Handover is at {base?.label} only at the moment.
      </p>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.choices} role="group" aria-label={label}>
        <button type="button" style={s.choice(!open)} aria-pressed={!open} onClick={pickBase}>
          Our place
          <span style={s.choiceSub}>{base?.label} · free</span>
        </button>
        <button type="button" style={s.choice(open)} aria-pressed={open} onClick={() => setOpen(true)}>
          Somewhere else
          <span style={s.choiceSub}>We bring it to you · fee by distance</span>
        </button>
      </div>

      {open && (
        <>
          <div style={s.map}>
            <MapContainer
              center={value ? [value.lat, value.lng] : [base.lat, base.lng]}
              zoom={value ? 12 : 11}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <ClickCatcher onPick={(point) => onChange({ ...point, label: value?.label || '' })} />
              {/* The free allowance drawn as a ring, so "the first few
                  kilometres cost nothing" is something you can see rather
                  than a sentence to take on trust. */}
              {settings.freeKm > 0 && (
                <Circle
                  center={[base.lat, base.lng]}
                  radius={(settings.freeKm / settings.roadFactor) * 1000}
                  pathOptions={{ color: gold, weight: 1, fillColor: gold, fillOpacity: 0.07 }}
                />
              )}
              <Marker position={[base.lat, base.lng]} icon={dot('#9ca3af', 14)} />
              {value && <Marker position={[value.lat, value.lng]} icon={dot(gold, 18)} />}
            </MapContainer>
          </div>
          <p style={s.hint}>
            Tap the map where you want the vehicle. The shaded ring is free; past it we charge
            ₱{settings.ratePerKm} per kilometre.
          </p>

          {value && (
            <>
              <input
                type="text"
                style={s.input}
                placeholder="Landmark or address in your own words"
                aria-label={`${label} — address`}
                value={value.label || ''}
                maxLength={120}
                onChange={(e) => onChange({ ...value, label: e.target.value })}
              />
              {quote.ok ? (
                <div style={s.quote} id={describedBy}>
                  <span>
                    {quote.km} km from {base.label}
                    {quote.chargeableKm < quote.km && ` · first ${settings.freeKm} km free`}
                  </span>
                  <span style={s.fee}>{quote.fee > 0 ? `₱${quote.fee.toLocaleString()}` : 'Free'}</span>
                </div>
              ) : (
                <div style={s.refusal} id={describedBy}>{deliveryRefusal(quote.reason, settings)}</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PlacePicker;
