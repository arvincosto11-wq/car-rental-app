import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, goldInk } from '../theme';
import { dwellState, dwellLabel, formatDwell, MIN_REPORTABLE_MS } from '../utils/dwell';
import Skeleton from './Skeleton';
import api from '../api';

const LEGAZPI_CENTER = [13.1391, 123.7438];

// How often we ask the server for fresh positions, and how often the
// on-screen durations tick over between those asks. Refreshing the whole
// fleet costs an outgoing request per tracker, so it is the slower of the
// two; a clock that only moved every 30 seconds would look stuck.
const POLL_MS = 30000;
const TICK_MS = 5000;

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
// (gold = selected, blue = currently rented, gray = available).
//
// Filled vs. hollow is the first thing to read, and it was missing: with
// one real tracker among twelve placeholders, every pin looked the same, so
// the one vehicle actually out there was invisible among the twelve that
// were never anywhere. A placeholder is now drawn hollow and a little
// smaller — present enough to click, obviously not a reading.
//
// An engine left running gets an amber halo on top of whatever the pin
// already says. It is the one state on this map somebody might want to act
// on straight away, and finding it by reading every card defeats the point
// of having a map.
const pinIcon = ({ color, idling, mock }) => {
  const size = mock ? 14 : 18;
  const body = mock
    ? `background:#fff;border:2px solid ${color};opacity:0.85;box-shadow:0 1px 3px rgba(0,0,0,0.25);`
    : `background:${color};border:3px solid #fff;box-shadow:${
      idling ? '0 0 0 4px rgba(217,119,6,0.4),' : ''
    }0 1px 4px rgba(0,0,0,0.4);`;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;${body}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Shared by the admin and consignor GPS Tracking pages — data scope (all
// cars vs. just the consignor's own) is handled server-side by GET
// /cars/gps-fleet, so this component doesn't need to know which role it's
// rendering for. Plate numbers are the one visible difference: the server
// strips them for consignors, so everything here treats a missing plate as
// normal rather than as an error.
const GpsTrackingView = () => {
  const { isDark } = useTheme();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [fetchedAt, setFetchedAt] = useState(null);
  const [stale, setStale] = useState(false);
  // Only here to re-render the durations between polls — the values
  // themselves are worked out from what the server last sent.
  const [, setTick] = useState(0);
  const mapRef = useRef(null);

  const load = useCallback(({ initial = false } = {}) => api.get('/cars/gps-fleet')
    .then((res) => {
      setCars(res.data);
      setFetchedAt(new Date());
      setStale(false);
    })
    .catch((err) => {
      console.error(err);
      // A failed refresh leaves the last known positions on the map rather
      // than blanking it — they are still the best we have, they are just
      // no longer live, and the pill says so.
      if (initial) setCars([]);
      setStale(true);
    })
    .finally(() => { if (initial) setLoading(false); }), []);

  useEffect(() => { load({ initial: true }); }, [load]);

  // Polling stops while the tab is in the background. Every refresh is an
  // outgoing request per tracker to a platform that never agreed to serve
  // us, and a dashboard left open on a second monitor all afternoon would
  // otherwise poll it a thousand times for nobody.
  useEffect(() => {
    let timer = null;
    const start = () => { if (!timer) timer = setInterval(load, POLL_MS); };
    const stop = () => { clearInterval(timer); timer = null; };
    const onVisibility = () => {
      if (document.hidden) { stop(); return; }
      load();
      start();
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const focusCar = (car) => {
    setSelectedId(car._id);
    mapRef.current?.flyTo([car.gps.lat, car.gps.lng], 15, { duration: 0.6 });
  };

  const anyMock = cars.some((c) => c.gps?.isMock);
  const isMoving = (car) => dwellState(car.gps).state === 'moving';
  const isIdling = (car) => dwellState(car.gps).state === 'idling';
  // A parked vehicle is in neither of the other two counts, so with one
  // tracker on a parked car both of them read zero and the page looks dead
  // while working perfectly. This is the chip that answers "is anything
  // actually reporting".
  const isTracked = (car) => !car.gps?.isMock;
  const movingCount = cars.filter(isMoving).length;
  const idlingCount = cars.filter(isIdling).length;
  const trackedCount = cars.filter(isTracked).length;

  const q = search.trim().toLowerCase();
  const filteredCars = cars.filter((car) => {
    if (filter === 'moving' && !isMoving(car)) return false;
    if (filter === 'idling' && !isIdling(car)) return false;
    if (filter === 'tracked' && !isTracked(car)) return false;
    if (!q) return true;
    return `${car.brand} ${car.model} ${car.plateNumber || ''}`.toLowerCase().includes(q);
  });

  const emptyMessage = () => {
    if (filter === 'moving') return 'No vehicles are on the road right now.';
    if (filter === 'idling') return 'Nothing is sitting with its engine running.';
    if (filter === 'tracked') return 'No vehicle has a GPS tracker connected yet.';
    return `No vehicles match "${search}".`;
  };

  const s = {
    head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' },
    livePill: (ok) => ({
      display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderRadius: '20px',
      fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
      background: ok ? (isDark ? 'rgba(22,163,74,0.18)' : '#dcfce7') : (isDark ? '#3a3b3c' : '#e5e7eb'),
      color: ok ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    liveDot: (ok) => ({
      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
      background: ok ? '#16a34a' : (isDark ? '#8a8d91' : '#9ca3af'),
    }),
    chips: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    chip: (active) => ({
      fontSize: '12px', fontWeight: '600', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
      border: `1px solid ${active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : (isDark ? '#242526' : '#fff'),
      color: active ? goldInk(isDark) : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    chipCount: { marginLeft: '5px', opacity: 0.75, fontVariantNumeric: 'tabular-nums' },
    notice: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px',
      background: isDark ? '#3a2f10' : '#fff7e6', border: `1px solid ${isDark ? '#5a4a1a' : '#f3d98b'}`,
      color: isDark ? '#e8c463' : '#8a6d1a', fontSize: '13px', marginBottom: '16px',
    },
    searchInput: {
      width: '100%', padding: '9px 12px', marginBottom: '10px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', flexShrink: 0,
      background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    layout: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' },
    mapWrap: { height: '520px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    // Search sits inside this panel (above the scrollable card stack)
    // rather than spanning the whole width above the map too, since it's
    // really filtering the list someone is scanning — the map just
    // reacts to it. Split into a fixed header (search) + its own
    // scrolling region so the input doesn't scroll away with the cards.
    listPanel: {
      display: 'flex', flexDirection: 'column',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '10px',
    },
    list: {
      display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto',
    },
    card: (active) => ({
      textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${active ? (isDark ? GOLD_DARK : GOLD) : 'transparent'}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : (isDark ? '#18191a' : '#f9fafb'),
    }),
    cardTop: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' },
    cardName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    // Two vehicles of the same make and model were two identical rows
    // before this — the plate is the only thing that tells them apart.
    cardPlate: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em',
      color: isDark ? '#b0b3b8' : '#6b7280', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
    },
    cardMeta: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '3px', fontVariantNumeric: 'tabular-nums' },
    pills: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' },
    pill: (mock) => ({
      fontSize: '10px', fontWeight: '600', padding: '2px 8px',
      borderRadius: '20px', background: mock ? (isDark ? '#3a3b3c' : '#e5e7eb') : '#16a34a',
      color: mock ? (isDark ? '#b0b3b8' : '#6b7280') : '#fff',
    }),
    idlePill: {
      fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
      background: isDark ? 'rgba(245,158,11,0.18)' : '#fef3c7',
      color: isDark ? '#fbbf24' : '#92400e',
    },
    // Deliberately a different color family from the green/gray "Engine
    // on"/"Demo location" pill below — that's about the tracker's own
    // connectivity/ignition signal, this is about whether a customer
    // actually has the car out, a separate axis of information.
    statusPill: (rented) => ({
      fontSize: '10px', fontWeight: '600', padding: '2px 8px',
      borderRadius: '20px', background: rented ? (isDark ? '#1e40af' : '#dbeafe') : (isDark ? '#3a3b3c' : '#e5e7eb'),
      color: rented ? (isDark ? '#bfdbfe' : '#1e40af') : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    popRows: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px', margin: '8px 0 0', fontSize: '11.5px' },
    popKey: { color: '#6b7280' },
    popVal: { margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    empty: { padding: '40px 20px', textAlign: 'center', color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '14px' },
  };

  if (loading) {
    return <Skeleton height="520px" radius="12px" isDark={isDark} />;
  }

  if (cars.length === 0) {
    return <div style={s.empty}>No vehicles to track yet.</div>;
  }

  const live = !stale;

  return (
    <div>
      <div style={s.head}>
        <div style={s.chips} role="group" aria-label="Filter vehicles">
          <button type="button" style={s.chip(filter === 'moving')} aria-pressed={filter === 'moving'} onClick={() => setFilter('moving')}>
            On the road <span style={s.chipCount}>{movingCount}</span>
          </button>
          <button type="button" style={s.chip(filter === 'idling')} aria-pressed={filter === 'idling'} onClick={() => setFilter('idling')}>
            Idling <span style={s.chipCount}>{idlingCount}</span>
          </button>
          <button type="button" style={s.chip(filter === 'tracked')} aria-pressed={filter === 'tracked'} onClick={() => setFilter('tracked')}>
            Tracked <span style={s.chipCount}>{trackedCount}</span>
          </button>
          <button type="button" style={s.chip(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All vehicles <span style={s.chipCount}>{cars.length}</span>
          </button>
        </div>
        <span style={s.livePill(live)} aria-live="polite">
          <span style={s.liveDot(live)} />
          {live ? `Live · updated ${timeAgo(fetchedAt)}` : 'Reconnecting — positions may be out of date'}
        </span>
      </div>

      {anyMock && (
        <div style={s.notice}>
          Some vehicles don't have a physical GPS tracker connected yet — their pin is drawn hollow, on a placeholder demo location, until one reports in.
        </div>
      )}
      <div className="gps-layout" style={s.layout}>
        <div style={s.mapWrap}>
          <MapContainer ref={mapRef} center={LEGAZPI_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {filteredCars.map((car) => {
              const d = dwellState(car.gps);
              return (
                <Marker
                  key={car._id}
                  position={[car.gps.lat, car.gps.lng]}
                  icon={pinIcon({
                    color: selectedId === car._id
                      ? (isDark ? GOLD_DARK : GOLD)
                      : (car.isRented && !car.gps.isMock ? '#2563eb' : '#9ca3af'),
                    idling: d.state === 'idling',
                    mock: car.gps.isMock,
                  })}
                  eventHandlers={{ click: () => setSelectedId(car._id) }}
                >
                  <Popup>
                    <strong>{car.brand} {car.model}</strong>
                    {car.plateNumber && <><br />{car.plateNumber}</>}
                    <dl style={s.popRows}>
                      <dt style={s.popKey}>Status</dt>
                      <dd style={s.popVal}>{car.isRented ? 'Rented' : 'Available'}</dd>
                      {car.gps.isMock ? (
                        <>
                          <dt style={s.popKey}>Tracker</dt>
                          <dd style={s.popVal}>Not connected</dd>
                          <dt style={s.popKey}>Position</dt>
                          <dd style={s.popVal}>Demo location</dd>
                        </>
                      ) : (
                        <>
                          <dt style={s.popKey}>Speed</dt>
                          <dd style={s.popVal}>{Math.round(car.gps.speed ?? 0)} km/h</dd>
                          <dt style={s.popKey}>Ignition</dt>
                          <dd style={s.popVal}>{car.gps.ignitionOn ? 'ON' : 'OFF'}</dd>
                          {d.ms !== null && d.ms >= MIN_REPORTABLE_MS && (
                            <>
                              <dt style={s.popKey}>{d.state === 'idling' ? 'Idle for' : 'Parked for'}</dt>
                              {/* A trailing + means we were not watching the
                                  whole time, so this is a floor, not the
                                  real figure — see utils/dwell.js. */}
                              <dd style={s.popVal}>{formatDwell(d.ms)}{d.atLeast ? '+' : ''}</dd>
                            </>
                          )}
                          <dt style={s.popKey}>Last update</dt>
                          <dd style={s.popVal}>{timeAgo(car.gps.updatedAt)}</dd>
                        </>
                      )}
                    </dl>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
        <div style={s.listPanel}>
          <input
            type="text"
            style={s.searchInput}
            placeholder="Search by brand, model, or plate number..."
            aria-label="Search vehicles"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={s.list}>
            {filteredCars.length === 0 ? (
              <div style={s.empty}>{emptyMessage()}</div>
            ) : (
              filteredCars.map((car) => {
                const d = dwellState(car.gps);
                return (
                  <button
                    type="button"
                    key={car._id}
                    style={s.card(selectedId === car._id)}
                    onClick={() => focusCar(car)}
                  >
                    <div style={s.cardTop}>
                      <span style={s.cardName}>{car.brand} {car.model}</span>
                      {car.plateNumber && <span style={s.cardPlate}>{car.plateNumber}</span>}
                    </div>
                    <div style={s.cardMeta}>
                      {car.gps.isMock
                        ? 'No tracker connected'
                        : `${dwellLabel(car.gps)} · ${timeAgo(car.gps.updatedAt)}`}
                    </div>
                    <div style={s.pills}>
                      <span style={s.statusPill(car.isRented)}>{car.isRented ? 'Rented' : 'Available'}</span>
                      {car.gps.isMock && <span style={s.pill(true)}>Demo location</span>}
                      {!car.gps.isMock && d.state === 'idling' && <span style={s.idlePill}>Engine on</span>}
                      {!car.gps.isMock && d.state === 'moving' && <span style={s.pill(false)}>Moving</span>}
                      {!car.gps.isMock && d.state === 'parked' && <span style={s.pill(true)}>Parked</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GpsTrackingView;
