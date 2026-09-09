import { useRef, useState, useEffect } from 'react';
import { GOLD, GOLD_DARK } from '../theme';

// Six separate boxes instead of one plain text field — auto-advances as you
// type, supports pasting the whole code at once, and Backspace on an empty
// box jumps back to the previous one.
const OtpInput = ({ length = 6, value, onChange, isDark, autoFocus = true }) => {
  const inputsRef = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(null);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const setDigits = (next) => onChange(next.join('').slice(0, length));

  const handleChange = (index, raw) => {
    const clean = raw.replace(/[^0-9]/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    // Handles a full code being pasted or autofilled into a single box.
    const next = [...digits];
    let i = index;
    for (const ch of clean) {
      if (i >= length) break;
      next[i] = ch;
      i += 1;
    }
    setDigits(next);
    inputsRef.current[Math.min(i, length - 1)]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex((cur) => (cur === i ? null : cur))}
          aria-label={`Digit ${i + 1} of ${length}`}
          style={{
            width: '42px', height: '48px', textAlign: 'center', fontSize: '20px', fontWeight: '700',
            borderRadius: '8px', outline: 'none', boxSizing: 'border-box',
            border: focusedIndex === i
              ? `2px solid ${isDark ? GOLD_DARK : GOLD}`
              : `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
            background: isDark ? '#0f172a' : '#fff',
            color: isDark ? '#f1f5f9' : '#111827',
          }}
        />
      ))}
    </div>
  );
};

export default OtpInput;
