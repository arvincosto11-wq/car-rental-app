import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

// The "Your trip" panel beside the booking wizard: what you are booking,
// what you have chosen so far, and what it costs.
//
// Separate from BookingSteps rather than an option on it. That one is a
// plain stepper with connectors, used by both registration flows, and this
// one reads a booking back — three row states, a summary per row, and the
// price at the bottom. Bending one component into both would have made a
// component with two personalities and two sets of callers to break.
//
// Each row is one of three things:
//   done        a gold circle with a check, and the choice itself. Clicking
//               it goes back to that step.
//   choosing    a raised card, so the eye lands on where you are without a
//               second colour doing the work.
//   not yet     an outlined circle, and nothing to click.
const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

const TripPanel = ({
  steps, currentStep, onStepClick, isDark, vehicleName, vehicleMeta, money,
}) => {
  const gold = isDark ? GOLD_DARK : GOLD;
  const border = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#6b7280';
  const card = isDark ? '#242526' : '#ffffff';
  const hatch = isDark ? '#4a4b4d' : '#d7dade';

  const s = {
    head: { padding: '0 6px' },
    kicker: { fontSize: '12px', fontWeight: '650', color: text2, letterSpacing: '0.02em' },
    name: { fontSize: '16px', fontWeight: '700', marginTop: '2px', color: text },
    meta: { fontSize: '13px', color: text2 },
    list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
    row: (state) => ({
      display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%',
      minHeight: '44px', padding: '10px 8px', marginBottom: '2px',
      border: 'none', borderRadius: '10px',
      background: state === 'choosing' ? card : 'transparent',
      // A ring rather than a border, so the raised card does not shift the
      // rows around it by a pixel when the step changes.
      boxShadow: state === 'choosing' ? `0 0 0 1px ${border}` : 'none',
      color: state === 'not-yet' ? text2 : text,
      fontFamily: 'inherit', fontSize: '14px', textAlign: 'left',
      cursor: state === 'done' ? 'pointer' : 'default',
    }),
    dot: (state) => ({
      width: '24px', height: '24px', flexShrink: 0, boxSizing: 'border-box',
      borderRadius: '999px', display: 'grid', placeItems: 'center',
      fontSize: '12px', fontWeight: '700',
      background: state === 'not-yet' ? 'transparent' : gold,
      color: state === 'not-yet' ? text2 : ON_GOLD,
      border: state === 'not-yet' ? `1.5px solid ${hatch}` : 'none',
    }),
    text: { display: 'flex', flexDirection: 'column', minWidth: 0 },
    label: { fontSize: '12px', color: text2 },
    value: { fontWeight: '600', overflowWrap: 'anywhere' },
    money: { marginTop: 'auto', padding: '14px 6px 0', borderTop: `1px solid ${border}` },
  };

  return (
    <>
      <div style={s.head}>
        <div style={s.kicker}>YOUR TRIP</div>
        <div style={s.name}>{vehicleName}</div>
        <div style={s.meta}>{vehicleMeta}</div>
      </div>

      <ul style={s.list}>
        {steps.map((step, i) => {
          const n = i + 1;
          const state = n < currentStep ? 'done' : n === currentStep ? 'choosing' : 'not-yet';
          // The summary survives going back: a step you answered and then
          // stepped behind still shows what you chose, rather than
          // pretending you never got there.
          const value = state === 'choosing'
            ? 'Choosing now'
            : (step.summary || (state === 'done' ? step.label : 'Not yet'));
          return (
            <li key={step.label}>
              <button
                type="button"
                style={s.row(state)}
                disabled={state !== 'done'}
                aria-current={state === 'choosing' ? 'step' : undefined}
                aria-label={state === 'done' ? `Back to step ${n}: ${step.label}` : undefined}
                onClick={state === 'done' ? () => onStepClick(n) : undefined}
              >
                <span style={s.dot(state)} aria-hidden="true">
                  {state === 'done' ? <Check /> : n}
                </span>
                <span style={s.text}>
                  <span style={s.label}>{step.label}</span>
                  <span style={s.value}>{value}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {money && <div style={s.money}>{money}</div>}
    </>
  );
};

export default TripPanel;
