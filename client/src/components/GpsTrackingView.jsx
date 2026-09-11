import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import Skeleton from './Skeleton';
import api from '../api';

const LEGAZPI_CENTER = [13.1391, 123.7438];

const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// A plain colored-dot divIcon instead of Leaflet's default marker — sidesteps
// the well-known bundler issue where Leaflet's default icon image paths
// don't resolve under Vite, and lets the pin color communicate status
// (gold = selected, gray = placeholder/not yet connected, green = live).
const pinIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Shared by the admin and consignor GPS Tracking pages — data scope (all
// cars vs. just the consignor's own) is handled server-side by GET
// /cars/gps-fleet, so this component doesn't need to know which role it's
// rendering for.
const GpsTrackingView = () => {
  const { isDark } = useTheme();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    api.get('/cars/gps-fleet')
      .then((res) => setCars(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const focusCar = (car) => {
    setSelectedId(car._id);
    mapRef.current?.flyTo([car.gps.lat, car.gps.lng], 15, { duration: 0.6 });
  };

  const anyMock = cars.some((c) => c.gps?.isMock);

  const s = {
    notice: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px',
      background: isDark ? '#3a2f10' : '#fff7e6', border: `1px solid ${isDark ? '#5a4a1a' : '#f3d98b'}`,
      color: isDark ? '#e8c463' : '#8a6d1a', fontSize: '13px', marginBottom: '16px',
    },
    layout: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' },
    mapWrap: { height: '520px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    list: {
      display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '10px',
    },
    card: (active) => ({
      textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${active ? (isDark ? GOLD_DARK : GOLD) : 'transparent'}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : (isDark ? '#18191a' : '#f9fafb'),
    }),
    cardName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    cardMeta: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px' },
    pill: (mock) => ({
      display: 'inline-block', marginTop: '6px', fontSize: '10px', fontWeight: '600', padding: '2px 8px',
      borderRadius: '20px', background: mock ? (isDark ? '#3a3b3c' : '#e5e7eb') : '#16a34a',
      color: mock ? (isDark ? '#b0b3b8' : '#6b7280') : '#fff',
    }),
    empty: { padding: '40px 20px', textAlign: 'center', color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '14px' },
  };

  if (loading) {
    return <Skeleton height="520px" radius="12px" isDark={isDark} />;
  }

  if (cars.length === 0) {
    return <div style={s.empty}>No vehicles to track yet.</div>;
  }

  return (
    <div>
      {anyMock && (
        <div style={s.notice}>
          Some vehicles don't have a physical GPS tracker connected yet — their pin shows a placeholder demo location until one reports in.
        </div>
      )}
      <div className="gps-layout" style={s.layout}>
        <div style={s.mapWrap}>
          <MapContainer ref={mapRef} center={LEGAZPI_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {cars.map((car) => (
              <Marker
                key={car._id}
                position={[car.gps.lat, car.gps.lng]}
                icon={pinIcon(selectedId === car._id ? (isDark ? GOLD_DARK : GOLD) : (car.gps.isMock ? '#9ca3af' : '#16a34a'))}
                eventHandlers={{ click: () => setSelectedId(car._id) }}
              >
                <Popup>
                  <strong>{car.brand} {car.model}</strong><br />
                  {car.gps.isMock
                    ? 'Demo location — tracker not yet connected'
                    : `${car.gps.speed ?? 0} km/h · ${car.gps.ignitionOn ? 'Engine on' : 'Engine off'} · ${timeAgo(car.gps.updatedAt)}`}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <div style={s.list}>
          {cars.map((car) => (
            <button
              type="button"
              key={car._id}
              style={s.card(selectedId === car._id)}
              onClick={() => focusCar(car)}
            >
              <div style={s.cardName}>{car.brand} {car.model}</div>
              <div style={s.cardMeta}>
                {car.gps.isMock ? 'Not yet connected' : `${car.gps.speed ?? 0} km/h · ${timeAgo(car.gps.updatedAt)}`}
              </div>
              <span style={s.pill(car.gps.isMock)}>{car.gps.isMock ? 'Demo location' : (car.gps.ignitionOn ? 'Engine on' : 'Parked')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GpsTrackingView;
