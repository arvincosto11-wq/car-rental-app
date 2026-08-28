// Shimmering placeholder block used while data is loading.
const Skeleton = ({ width = '100%', height = '16px', radius = '6px', isDark, style = {} }) => (
  <div
    className="skeleton"
    style={{
      width,
      height,
      borderRadius: radius,
      background: isDark
        ? 'linear-gradient(90deg, #1e293b 25%, #334155 37%, #1e293b 63%)'
        : 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%)',
      backgroundSize: '400% 100%',
      ...style,
    }}
  />
);

// Shared placeholder shape for a booking-style list row (thumbnail + a
// couple of text lines), used by My Bookings, Rate My Bookings, Rate
// Clients, and the consignor booking list while data is loading.
export const SkeletonListCard = ({ isDark, count = 3 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{
          display: 'flex', gap: '16px', alignItems: 'center', padding: '16px',
          border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px',
          background: isDark ? '#1e293b' : '#fff',
        }}
      >
        <Skeleton width="100px" height="70px" radius="8px" isDark={isDark} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width="35%" height="11px" isDark={isDark} />
          <Skeleton width="65%" height="16px" isDark={isDark} />
          <Skeleton width="45%" height="11px" isDark={isDark} />
        </div>
      </div>
    ))}
  </div>
);

// Placeholder shape for a table's body rows, used by admin list pages.
export const SkeletonTableRows = ({ isDark, rows = 5, columns = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: columns }).map((_, c) => (
          <td key={c} style={{ padding: '12px 16px' }}>
            <Skeleton height="14px" width={c === 0 ? '80%' : '60%'} isDark={isDark} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export default Skeleton;
