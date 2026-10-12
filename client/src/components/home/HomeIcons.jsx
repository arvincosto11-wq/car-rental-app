// The homepage's icon set.
//
// Drawn as inline SVG paths rather than emoji. The page used 🚗 💰 📅 🎧
// and 📞 📍 🕒, which render in the system emoji font — on Windows the
// phone and the pin come out red and pink, sitting beside our gold and
// brown looking like they wandered in from another site. A drawn icon
// takes the colour it is given.
//
// One stroke weight, one corner treatment, so a row of them reads as a
// set. Always aria-hidden: the meaning is in the text beside them.
const PATHS = {
  car: ['M5 13l1.7-4.6A2 2 0 0 1 8.6 7h6.8a2 2 0 0 1 1.9 1.4L19 13', 'M3.5 13h17v4.5h-17z', 'M6 17.5v2', 'M18 17.5v2', 'M7 15.2h1.5', 'M15.5 15.2H17'],
  tag: ['M3.5 12.5l8.2-8.2h7.6v7.6l-8.2 8.2z', 'M14.6 8.6a.9.9 0 1 0 1.8 0a.9.9 0 1 0 -1.8 0', 'M8.5 13.5l2.4 2.4'],
  cal: ['M4 6.5h16v13.5H4z', 'M4 10.5h16', 'M8.5 4v4', 'M15.5 4v4', 'M8 14h2', 'M13.5 14h2', 'M8 17h2'],
  headset: ['M4.5 14v-2a7.5 7.5 0 0 1 15 0v2', 'M4 13.5h3v5H5a1 1 0 0 1-1-1z', 'M20 13.5h-3v5h2a1 1 0 0 0 1-1z', 'M17 18.5c0 1.5-1.5 2.5-4 2.5'],
  wallet: ['M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5z', 'M4 7.5l11-3.5 1 3.5', 'M15.5 13.5h1.5'],
  key: ['M3.5 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M10.4 12.4L19 4', 'M16 7l2.5 2.5', 'M13.6 9.4l1.8 1.8'],
  wedding: ['M3.5 14a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0', 'M9.5 14a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0', 'M12 3.5l1.8 2.2-1.8 1.6-1.8-1.6z'],
  airport: ['M3 20.5h18', 'M4.5 14.5l2.8 1.2 10.4-5.6c1.3-.7 2.8.3 2.3 1.6l-.6 1.1-12.6 4.7-3-1.8', 'M9 11l3.2 1.4', 'M6 9.8l1.8.9'],
  trip: ['M4 21c2-6 3-11 6-17', 'M20 21c-2-6-3-11-6-17', 'M12 6v2', 'M12 11.5v2.5', 'M12 17.5v3'],
  event: ['M5 8a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M14 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0', 'M2.5 20c.3-3.4 2.6-6 5.5-6s5.2 2.6 5.5 6', 'M14.2 14.6c.7-.3 1.5-.5 2.3-.5 2.7 0 4.8 2.3 5 5.4'],
  phone: ['M7.5 4.5h3l1.3 3.4-1.9 1.4a11 11 0 0 0 4.8 4.8l1.4-1.9 3.4 1.3v3a1.5 1.5 0 0 1-1.6 1.5C11.4 17.4 6.6 12.6 6 5.9a1.5 1.5 0 0 1 1.5-1.4z'],
  pin: ['M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z', 'M9.6 10.5a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0'],
  clock: ['M3.8 12a8.2 8.2 0 1 0 16.4 0a8.2 8.2 0 1 0 -16.4 0', 'M12 7.3V12l3.2 2'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
};

const HomeIcon = ({ name, size = 22, stroke = 'currentColor', width = 1.6 }) => {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
};

export default HomeIcon;
