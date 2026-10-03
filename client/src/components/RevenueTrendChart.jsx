import { useState, useRef, useEffect } from 'react';

// Rounded-top, square-bottom bar path (never a plain <rect rx>, which rounds
// every corner including the baseline).
const roundedTopBar = (x, y, w, h, r) => {
  const radius = Math.max(0, Math.min(r, h, w / 2));
  if (h <= 0) return '';
  return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} ` +
    `L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`;
};

const niceMax = (value) => {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  const step = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return step * magnitude;
};

const formatShort = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`);

// Single-series bar chart (originally built for monthly revenue, general
// enough for any small labeled series — e.g. booking counts). No legend
// needed (one series - the card title already says what's plotted); the
// last bar gets a direct label, the rest are reachable via hover/focus.
//
// `detailed` turns on the richer treatment the admin dashboard asks for:
// a tighter scale, a value over every bar, older bars dimmed so the current
// one reads first, and an average line. It is opt-in because this component
// also draws "Busiest Day of the Week" on Analytics, where the values are
// booking counts rather than pesos and the last bar is a Saturday rather
// than a month in progress — the rich version would state four things there
// that are not true. Everything below defaults to the original behaviour,
// so that page renders exactly as it did.
const RevenueTrendChart = ({
  data,
  isDark,
  barColor,
  barColorHover,
  formatValue,
  title,
  detailed = false,
  // Compact form used for the axis ticks and, in detailed mode, the label
  // over each bar. Kept separate from formatValue, which is the full figure
  // the tooltip shows.
  formatCompact,
  // Second line under the last bar, e.g. "to date". Only drawn in detailed
  // mode, and only when given.
  currentLabel = '',
  // Shown in place of an empty grid when every value is zero.
  emptyMessage = '',
}) => {
  const [active, setActive] = useState(null);
  const format = formatValue || ((v) => `₱${v.toLocaleString()}`);
  const compact = formatCompact || formatShort;

  // The chart used to be drawn at a fixed width and then squashed to fit,
  // which shrinks the lettering along with everything else — at a 1024px
  // window the 10px axis labels came out around 7px and stopped being
  // readable. Measuring the space instead means one SVG unit is one screen
  // pixel, so the text is the size it says it is at every width, and only
  // the bars get narrower.
  const wrapRef = useRef(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setMeasured(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const natural = detailed ? 740 : 600;
  // Below this the bars stop being bars. Narrower than this the chart goes
  // back to scaling, which is ugly but still legible — unreadable text in a
  // correctly sized box would be worse.
  const MIN_WIDTH = 320;
  const width = measured >= MIN_WIDTH ? measured : natural;
  const height = detailed ? 236 : 200;
  const padLeft = detailed ? 52 : 46;
  const padRight = 8;
  const padTop = detailed ? 22 : 16;
  const padBottom = detailed ? 34 : 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Coerced before anything is measured against it. One non-numeric point
  // — a month with no bookings arriving as undefined — turned maxValue into
  // NaN, which turned every grid line's y into NaN, which the browser
  // rejected as `Expected length, "undefined"`. The chart still drew its
  // bars, so it looked fine and complained four times in the console.
  const values = data.map((d) => (Number.isFinite(Number(d.value)) ? Number(d.value) : 0));
  const maxValue = Math.max(...values, 0);

  // Four equal steps chosen from a quarter of the peak, rather than one
  // rounded ceiling. niceMax(64,900) is 100,000, which leaves the tallest
  // bar at two thirds of the plot with dead space above it; four steps of
  // 20,000 top out at 80,000 and the same bar fills four fifths. niceMax
  // never rounds down, so the top is always at least the peak.
  const step = detailed ? niceMax(maxValue / 4) : 0;
  const scaleMax = detailed ? step * 4 : niceMax(maxValue);
  const gridColor = isDark ? '#3a3b3c' : '#e5e7eb';
  const axisTextColor = isDark ? '#8a8d91' : '#9ca3af';
  const labelColor = isDark ? '#e4e6eb' : '#1a1a1a';
  const mutedLabelColor = isDark ? '#b0b3b8' : '#4b5563';

  const bandWidth = chartW / data.length;
  const barWidth = Math.min(detailed ? 44 : 24, bandWidth - 10);
  const gridLines = detailed
    ? [0, 1, 2, 3, 4].map((i) => step * i)
    : [0, 0.25, 0.5, 0.75, 1].map((f) => scaleMax * f);

  const isEmpty = maxValue === 0;
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const showAverage = detailed && !isEmpty;

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} role="img" aria-label={title || 'Monthly revenue for the last 6 months'}>
      {gridLines.map((g, i) => {
        const y = padTop + chartH - (scaleMax > 0 ? (g / scaleMax) * chartH : 0);
        return (
          <g key={i}>
            <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke={gridColor} strokeWidth={1} />
            {/* An empty detailed chart keeps its gridlines but drops the
                numbers — a column of ₱0 ₱0 ₱0 said nothing and read as a
                fault. The pill below says it plainly instead. */}
            {!(detailed && isEmpty) && (
              <text x={padLeft - 8} y={y + 3} textAnchor="end" fontSize={detailed ? '10' : '9'} fill={axisTextColor}>
                {detailed ? compact(g) : formatShort(g)}
              </text>
            )}
          </g>
        );
      })}

      {showAverage && (
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={padTop + chartH - (average / scaleMax) * chartH}
          y2={padTop + chartH - (average / scaleMax) * chartH}
          stroke={axisTextColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      )}

      {detailed && isEmpty && emptyMessage && (
        <g>
          <rect
            x={padLeft + (chartW - 300) / 2} y={padTop + chartH / 2 - 15}
            width="300" height="30" rx="8"
            fill={isDark ? '#242526' : '#ffffff'} stroke={gridColor} strokeWidth={1}
          />
          <text x={padLeft + chartW / 2} y={padTop + chartH / 2 + 4} textAnchor="middle" fontSize="12" fill={mutedLabelColor}>
            {emptyMessage}
          </text>
        </g>
      )}

      {!(detailed && isEmpty) && data.map((d, i) => {
        const value = values[i];
        const barHeight = scaleMax > 0 ? Math.max((value / scaleMax) * chartH, value > 0 ? 2 : 0) : 0;
        const x = padLeft + i * bandWidth + (bandWidth - barWidth) / 2;
        const y = padTop + chartH - barHeight;
        const isLast = i === data.length - 1;
        const isActive = active === i;

        return (
          <g
            key={d.label}
            tabIndex={0}
            role="button"
            aria-label={`${d.label}: ${format(d.value)}`}
            style={{ cursor: 'pointer', outline: 'none' }}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <rect x={padLeft + i * bandWidth} y={padTop} width={bandWidth} height={chartH} fill="transparent" />
            <path
              d={roundedTopBar(x, y, barWidth, barHeight, detailed ? 5 : 4)}
              fill={isActive ? barColorHover : barColor}
              /* Older months step back so the one still being earned reads
                 first. Hovering brings any of them fully forward. */
              opacity={detailed && !isLast && !isActive ? 0.55 : 1}
            />
            <text
              x={x + barWidth / 2}
              y={height - padBottom + 14}
              textAnchor="middle"
              fontSize={detailed ? '11' : '10'}
              fontWeight={detailed && isLast ? '700' : '400'}
              fill={detailed && isLast ? labelColor : axisTextColor}
            >
              {d.label}
            </text>
            {detailed && isLast && currentLabel && (
              <text x={x + barWidth / 2} y={height - padBottom + 26} textAnchor="middle" fontSize="10" fill={axisTextColor}>
                {currentLabel}
              </text>
            )}

            {/* Every bar carries its figure in detailed mode; otherwise only
                the last one does and the rest are found by hovering. */}
            {((detailed && !isActive) || (isLast && !isActive && !detailed)) && (
              <text
                x={x + barWidth / 2}
                y={y - (detailed ? 6 : 8)}
                textAnchor="middle"
                fontSize="11"
                fontWeight={detailed ? (isLast ? '700' : '500') : '700'}
                fill={detailed && !isLast ? mutedLabelColor : labelColor}
              >
                {detailed ? compact(d.value) : format(d.value)}
              </text>
            )}

            {isActive && (
              <g>
                <rect x={Math.min(Math.max(x + barWidth / 2 - 42, padLeft), width - padRight - 84)} y={Math.max(y - 32, padTop)} width="84" height="24" rx="6" fill={isDark ? '#e4e6eb' : '#1a1a1a'} />
                <text x={Math.min(Math.max(x + barWidth / 2, padLeft + 42), width - padRight - 42)} y={Math.max(y - 32, padTop) + 16} textAnchor="middle" fontSize="11" fontWeight="700" fill={isDark ? '#18191a' : '#ffffff'}>
                  {format(d.value)}
                </text>
              </g>
            )}
          </g>
        );
      })}
      </svg>
    </div>
  );
};

export default RevenueTrendChart;
