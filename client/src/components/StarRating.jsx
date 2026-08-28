const StarRating = ({ value = 0, onChange, size = 18, readOnly = false }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {stars.map((n) => (
        <span
          key={n}
          onClick={readOnly ? undefined : () => onChange(n)}
          onKeyDown={readOnly ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(n); } }}
          role={readOnly ? undefined : 'button'}
          tabIndex={readOnly ? undefined : 0}
          aria-label={readOnly ? undefined : `${n} star${n > 1 ? 's' : ''}`}
          style={{
            cursor: readOnly ? 'default' : 'pointer',
            color: n <= Math.round(value) ? '#f59e0b' : '#d1d5db',
            fontSize: size,
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
};

export default StarRating;
