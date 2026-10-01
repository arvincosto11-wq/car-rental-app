import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AdminLayout from '../../components/AdminLayout';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { legQuote } from '../../utils/delivery';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import api from '../../api';

const pin = (color) => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const ClickCatcher = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
};

// The rates behind every delivery quote, and the pin they are measured from.
//
// This is the first screen that edits the settings document, so it is also
// the first time any rule in this system has been changeable without a
// deploy. Everything here was a constant until now.
const DeliverySettings = () => {
  usePageTitle('Delivery Settings');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then((res) => setForm({
        base: { ...res.data.base },
        delivery: { ...res.data.delivery },
      }))
      .catch(() => toast.error('Could not load the settings.'))
      .finally(() => setLoading(false));
  }, [toast]);

  const setDelivery = (key, value) => setForm((f) => ({ ...f, delivery: { ...f.delivery, [key]: value } }));
  const setBase = (patch) => setForm((f) => ({ ...f, base: { ...f.base, ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/settings', form);
      setForm({ base: { ...res.data.base }, delivery: { ...res.data.delivery } });
      toast.success('Saved. New bookings quote the new rates — existing ones keep what they were charged.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    title: { fontSize: '22px', fontWeight: '700', marginBottom: '4px', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' },
    grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '20px', alignItems: 'start' },
    card: {
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '18px',
    },
    cardTitle: { fontSize: '14px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '2px' },
    cardSub: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '14px', lineHeight: 1.5 },
    map: { height: '320px', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    field: { marginBottom: '14px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: isDark ? '#e4e6eb' : '#374151' },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px', lineHeight: 1.5 },
    input: {
      width: '100%', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    toggleRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: isDark ? '#e4e6eb' : '#374151', marginBottom: '14px', cursor: 'pointer' },
    save: {
      padding: '10px 22px', borderRadius: '8px', border: 'none', cursor: saving ? 'default' : 'pointer',
      background: gold, color: ON_GOLD, fontSize: '13px', fontWeight: '700', opacity: saving ? 0.6 : 1,
    },
    example: {
      marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
      background: isDark ? '#18191a' : '#f9fafb', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      fontSize: '12px', color: isDark ? '#b0b3b8' : '#4b5563', lineHeight: 1.7,
    },
    exampleFee: { fontWeight: '700', color: goldInk(isDark) },
  };

  if (loading || !form) {
    return <AdminLayout activePage="Delivery"><Skeleton height="420px" radius="12px" isDark={isDark} /></AdminLayout>;
  }

  const flat = {
    enabled: form.delivery.enabled,
    base: form.base,
    freeKm: Number(form.delivery.freeKm) || 0,
    ratePerKm: Number(form.delivery.ratePerKm) || 0,
    maxKm: Number(form.delivery.maxKm) || 0,
    roadFactor: Number(form.delivery.roadFactor) || 1,
  };
  // Two real places, priced with whatever is currently in the form, so the
  // effect of a rate change is visible before it is saved rather than
  // discovered by a customer.
  const samples = [
    { name: 'Legazpi City', ...legQuote({ lat: 13.1391, lng: 123.7438 }, flat) },
    { name: 'Tabaco City', ...legQuote({ lat: 13.3587, lng: 123.7330 }, flat) },
  ];

  const numberField = (key, label, hint, suffix) => (
    <div style={s.field}>
      <label style={s.label} htmlFor={`ds-${key}`}>{label}</label>
      <input
        id={`ds-${key}`}
        type="number"
        min="0"
        step={key === 'roadFactor' ? '0.05' : '1'}
        style={s.input}
        value={form.delivery[key]}
        onChange={(e) => setDelivery(key, e.target.value === '' ? '' : Number(e.target.value))}
      />
      <p style={s.hint}>{hint}{suffix}</p>
    </div>
  );

  return (
    <AdminLayout activePage="Delivery">
      <h1 style={s.title}>Delivery</h1>
      <p style={s.subtitle}>Where you hand vehicles over, how far you go, and what you charge to get there.</p>

      <div className="booking-summary-grid" style={s.grid}>
        <div style={s.card}>
          <div style={s.cardTitle}>Your base</div>
          <p style={s.cardSub}>
            Every delivery distance is measured from this pin. Tap the map to move it.
            Moving it reprices future quotes only — bookings already made keep the fee they were given.
          </p>
          <div style={s.map}>
            <MapContainer center={[form.base.lat, form.base.lng]} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <ClickCatcher onPick={(lat, lng) => setBase({ lat, lng })} />
              {flat.freeKm > 0 && (
                <Circle
                  center={[form.base.lat, form.base.lng]}
                  radius={(flat.freeKm / flat.roadFactor) * 1000}
                  pathOptions={{ color: gold, weight: 1, fillColor: gold, fillOpacity: 0.07 }}
                />
              )}
              {flat.maxKm > 0 && (
                <Circle
                  center={[form.base.lat, form.base.lng]}
                  radius={(flat.maxKm / flat.roadFactor) * 1000}
                  pathOptions={{ color: '#9ca3af', weight: 1, dashArray: '5 5', fill: false }}
                />
              )}
              <Marker position={[form.base.lat, form.base.lng]} icon={pin(gold)} />
            </MapContainer>
          </div>
          <div style={{ ...s.field, marginTop: '12px', marginBottom: 0 }}>
            <label style={s.label} htmlFor="ds-label">What to call it</label>
            <input
              id="ds-label"
              type="text"
              style={s.input}
              maxLength={120}
              value={form.base.label}
              onChange={(e) => setBase({ label: e.target.value })}
            />
            <p style={s.hint}>Shown to customers as the free handover point.</p>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Rates</div>
          <p style={s.cardSub}>Applied to each leg separately — a delivery and a collection are two drives.</p>

          <label style={s.toggleRow}>
            <input
              type="checkbox"
              checked={form.delivery.enabled}
              onChange={(e) => setDelivery('enabled', e.target.checked)}
            />
            <span>Offer delivery. Off means handover at your base only.</span>
          </label>

          {numberField('freeKm', 'Free distance', 'Kilometres nobody is charged for. The shaded ring on the map.', '')}
          {numberField('ratePerKm', 'Rate per kilometre', 'Pesos charged for each kilometre past the free distance.', '')}
          {numberField('maxKm', 'Furthest you go', 'Past this, booking is refused with a note to call you. The dashed ring.', '')}
          {numberField('roadFactor', 'Road allowance', 'Roads are longer than straight lines. 1.3 adds 30% to every measured distance. Never below 1.', '')}

          <div style={s.example}>
            {samples.map((x) => (
              <div key={x.name}>
                {x.name} — {x.ok ? (
                  <>{x.km} km · <span style={s.exampleFee}>{x.fee > 0 ? `₱${x.fee.toLocaleString()}` : 'free'}</span></>
                ) : (
                  <span>{x.km} km · too far</span>
                )}
              </div>
            ))}
          </div>

          <button type="button" style={{ ...s.save, marginTop: '16px' }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default DeliverySettings;
