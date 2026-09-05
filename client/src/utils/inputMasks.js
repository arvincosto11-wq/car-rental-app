// Lightweight input masks/guards for admin car forms — normalize as the
// admin types instead of validating only on submit, so mistakes are caught
// immediately.

// "abc1234" / "abc-1234" -> "ABC 1234". Splits into letter/digit runs so it
// also handles digit-first or all-letter plates without forcing one shape.
export function formatPlateNumber(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const segments = clean.match(/[A-Z]+|[0-9]+/g) || [];
  return segments.join(' ').slice(0, 12);
}

export function sanitizeDigits(raw, maxLen) {
  return raw.replace(/[^0-9]/g, '').slice(0, maxLen);
}

// Digits with at most one decimal point, e.g. for a price that allows cents.
export function sanitizeDecimal(raw, maxLen) {
  const clean = raw.replace(/[^0-9.]/g, '');
  const firstDot = clean.indexOf('.');
  const noExtraDots = firstDot === -1 ? clean : clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
  return noExtraDots.slice(0, maxLen);
}
