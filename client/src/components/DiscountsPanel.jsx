import { useRef, useState } from 'react';
import useModalA11y from '../hooks/useModalA11y';
import PromoTab from './PromoTab';
import LongRentalTab from './LongRentalTab';
import { isPromoVisible } from '../utils/promo';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

// Every discount in one place, opened from the Manage Cars header. The two
// kinds stay separate underneath because they genuinely behave differently
// (a date promo is per car, can be pesos, marks the calendar and notifies
// favourites; a long-rental rule is a percentage by trip length across many
// cars) — only the screen is shared.
//
// Tabs follow the ARIA tabs pattern: arrow keys move between them, and only
// the selected tab is in the Tab order, so keyboard users don't have to walk
// through every tab to reach the content.

const TABS = [
  { id: 'promos', label: 'Date Promos' },
  { id: 'long-rental', label: 'Long-Rental' },
];

const DiscountsPanel = ({ cars, isDark, onClose, onCarUpdated, ruleCount, onRulesChanged, initialTab = 'promos' }) => {
  const [tab, setTab] = useState(initialTab);
  const tabRefs = useRef({});
  const panelRef = useModalA11y(onClose);

  const counts = {
    promos: cars.filter((c) => isPromoVisible(c.promo)).length,
    'long-rental': ruleCount,
  };

  const onTabKey = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
    if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
    if (e.key === 'Home') next = TABS[0];
    if (e.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto',
    },
    card: {
      position: 'relative', width: '100%', maxWidth: '580px', outline: 'none',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '16px', padding: '24px',
    },
    closeBtn: {
      position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%',
      border: 'none', background: isDark ? '#18191a' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
      fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: '17px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', paddingRight: '40px' },
    // A single sunken strip with the selected tab raised out of it — reads as
    // "one of these two", which separate buttons wouldn't.
    tabList: {
      display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`, gap: '4px',
      padding: '4px', margin: '16px 0 18px', borderRadius: '12px',
      background: isDark ? '#18191a' : '#f3f4f6', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    tab: (active) => ({
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
      padding: '9px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer',
      fontSize: '13px', fontWeight: '700', fontFamily: 'inherit',
      background: active ? (isDark ? '#3a3b3c' : '#fff') : 'transparent',
      color: active ? (isDark ? '#e4e6eb' : '#1a1a1a') : (isDark ? '#8a8d91' : '#6b7280'),
      boxShadow: active ? (isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.1)') : 'none',
      transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
    }),
    count: (active) => ({
      minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800',
      background: active ? gold : (isDark ? '#3a3b3c' : '#e5e7eb'),
      color: active ? ON_GOLD : (isDark ? '#b0b3b8' : '#4b5563'),
    }),
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div ref={panelRef} tabIndex={-1} style={s.card} onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="discounts-title">
        <button type="button" className="icon-toggle-btn" style={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
        <div id="discounts-title" style={s.title}>Discounts</div>

        <div role="tablist" aria-label="Kind of discount" style={s.tabList} onKeyDown={onTabKey}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[t.id] = el; }}
                type="button"
                role="tab"
                id={`discounts-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`discounts-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                className="seg-tab"
                style={s.tab(active)}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {counts[t.id] > 0 && <span style={s.count(active)}>{counts[t.id]}</span>}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`discounts-panel-${tab}`} aria-labelledby={`discounts-tab-${tab}`}>
          {tab === 'promos'
            ? <PromoTab cars={cars} isDark={isDark} onCarUpdated={onCarUpdated} />
            : <LongRentalTab cars={cars} isDark={isDark} onRulesChanged={onRulesChanged} />}
        </div>
      </div>
    </div>
  );
};

export default DiscountsPanel;
