// The line icons the consignment screens use.
//
// Defined once at module level rather than inside a page, because a
// component built during render is a new component on every render — React
// throws the subtree away and rebuilds it, and the lint rules here refuse
// it outright.
//
// Same family as the rest of the product: inline SVG, 24 viewBox, 1.8
// stroke, round caps and joins, no fill. Nothing imported from an icon pack.
const Line = ({ d, size = 20, stroke = 1.8 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const D = {
  car: 'M3 16v-4l2-5h14l2 5v4zM3 16v2h3v-2M18 16v2h3v-2M7 12.5h.01M17 12.5h.01',
  bike: 'M5.5 14.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18.5 14.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5.5 17.5l4-7h5l4 7M12 10.5l-2-4H7',
  ok: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  tick: 'M5 12l5 5 9-10',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  power: 'M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
};

export const CarIcon = (p) => <Line d={D.car} {...p} />;
export const BikeIcon = (p) => <Line d={D.bike} {...p} />;
export const OkIcon = (p) => <Line d={D.ok} {...p} />;
export const TickIcon = (p) => <Line d={D.tick} stroke={2.2} {...p} />;
export const CalIcon = (p) => <Line d={D.cal} {...p} />;
export const PowerIcon = (p) => <Line d={D.power} {...p} />;
export const InfoIcon = (p) => <Line d={D.info} {...p} />;
export const ImageIcon = (p) => <Line d={D.image} {...p} />;
export const MailIcon = (p) => <Line d={D.mail} {...p} />;
export const PhoneIcon = (p) => <Line d={D.phone} {...p} />;
export const PinIcon = (p) => <Line d={D.pin} {...p} />;
export const ArrowIcon = (p) => <Line d={D.arrow} stroke={2} {...p} />;
export const ChevronIcon = (p) => <Line d={D.chevron} stroke={2} {...p} />;
export const CloseIcon = (p) => <Line d={D.close} stroke={2} {...p} />;

// A motorcycle gets the motorcycle. Everything else is a car shape, which
// is near enough for a van or an SUV at 20 pixels.
export const VehicleIcon = ({ category, ...p }) => (
  category === 'Motorcycle' ? <BikeIcon {...p} /> : <CarIcon {...p} />
);
