import { useState } from 'react';

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
const RevenueTrendChart = ({ data, isDark, barColor, barColorHover, formatValue, title }) => {
  const [active, setActive] = useState(null);
  const format = formatValue || ((v) => `₱${v.toLocaleString()}`);

  const width = 600;
  const height = 200;
  const padLeft = 46;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxValue = Math.max(...data.map((d) => d.value), 0);
  const scaleMax = niceMax(maxValue);
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const axisTextColor = isDark ? '#64748b' : '#9ca3af';
  const labelColor = isDark ? '#f1f5f9' : '#1a1a1a';

  const bandWidth = chartW / data.length;
  const barWidth = Math.min(24, bandWidth - 10);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => scaleMax * f);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} role="img" aria-label={title || 'Monthly revenue for the last 6 months'}>
      {gridLines.map((g, i) => {
        const y = padTop + chartH - (g / scaleMax) * chartH;
        return (
          <g key={i}>
            <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke={gridColor} strokeWidth={1} />
            <text x={padLeft - 8} y={y + 3} textAnchor="end" fontSize="9" fill={axisTextColor}>{formatShort(g)}</text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const barHeight = scaleMax > 0 ? Math.max((d.value / scaleMax) * chartH, d.value > 0 ? 2 : 0) : 0;
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
            <path d={roundedTopBar(x, y, barWidth, barHeight, 4)} fill={isActive ? barColorHover : barColor} />
            <text x={x + barWidth / 2} y={height - padBottom + 14} textAnchor="middle" fontSize="10" fill={axisTextColor}>{d.label}</text>

            {isLast && !isActive && (
              <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill={labelColor}>
                {format(d.value)}
              </text>
            )}

            {isActive && (
              <g>
                <rect x={Math.min(Math.max(x + barWidth / 2 - 42, padLeft), width - padRight - 84)} y={Math.max(y - 32, padTop)} width="84" height="24" rx="6" fill={isDark ? '#f1f5f9' : '#1a1a1a'} />
                <text x={Math.min(Math.max(x + barWidth / 2, padLeft + 42), width - padRight - 42)} y={Math.max(y - 32, padTop) + 16} textAnchor="middle" fontSize="11" fontWeight="700" fill={isDark ? '#0f172a' : '#ffffff'}>
                  {format(d.value)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default RevenueTrendChart;
