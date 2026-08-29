import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

// Vertical step indicator for the Car Detail booking flow (collapses to a
// horizontal row on mobile via CSS in index.css). Completed steps are
// clickable to jump back; upcoming steps aren't, since their content
// depends on validating the step before them.
const BookingSteps = ({ steps, currentStep, onStepClick, isDark }) => {
  const s = {
    list: { display: 'flex', flexDirection: 'column' },
    itemWrap: { display: 'flex', flexDirection: 'column' },
    row: { display: 'flex', alignItems: 'center', gap: '10px' },
    circle: (state) => ({
      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: '700',
      background: state === 'upcoming' ? 'transparent' : (isDark ? GOLD_DARK : GOLD),
      color: state === 'upcoming' ? (isDark ? '#64748b' : '#9ca3af') : ON_GOLD,
      border: state === 'upcoming' ? `2px solid ${isDark ? '#334155' : '#d1d5db'}` : 'none',
    }),
    label: (state) => ({
      fontSize: '13px', fontWeight: state === 'active' ? '700' : '500',
      color: state === 'upcoming' ? (isDark ? '#64748b' : '#9ca3af') : (isDark ? '#f1f5f9' : '#1a1a1a'),
    }),
    connector: (done) => ({
      width: '2px', height: '22px', marginLeft: '13px',
      background: done ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#334155' : '#d1d5db'),
    }),
  };

  return (
    <div className="booking-steps-list" style={s.list}>
      {steps.map((step, i) => {
        const n = i + 1;
        const state = n < currentStep ? 'done' : n === currentStep ? 'active' : 'upcoming';
        const clickable = n < currentStep;
        return (
          <div key={step} className="booking-step-item-wrap" style={s.itemWrap}>
            <div
              className="booking-step-row"
              style={{ ...s.row, cursor: clickable ? 'pointer' : 'default' }}
              onClick={() => clickable && onStepClick(n)}
              onKeyDown={(e) => { if (clickable && e.key === 'Enter') onStepClick(n); }}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span style={s.circle(state)}>{state === 'done' ? '✓' : n}</span>
              <span className="booking-step-label" style={s.label(state)}>{step}</span>
            </div>
            {i < steps.length - 1 && <div className="booking-step-connector" style={s.connector(n < currentStep)} />}
          </div>
        );
      })}
    </div>
  );
};

export default BookingSteps;
