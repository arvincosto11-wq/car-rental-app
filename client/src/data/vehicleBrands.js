// Popular vehicle brands/models in the Philippines, used to power the
// Brand/Model dropdowns on the admin Add Vehicle form. Each model carries its
// own category so picking a model can auto-fill the Category field (which
// stays editable in case a model isn't listed here or the guess is wrong).
// Not exhaustive — "Other" is always available so admin can type anything
// not listed here.

export const VEHICLE_DATA = {
  Toyota: [
    { model: 'Vios', category: 'Sedan' },
    { model: 'Corolla Altis', category: 'Sedan' },
    { model: 'Camry', category: 'Sedan' },
    { model: 'Wigo', category: 'Hatchback' },
    { model: 'Avanza', category: 'Van' },
    { model: 'Innova', category: 'Van' },
    { model: 'Hiace', category: 'Van' },
    { model: 'Fortuner', category: 'SUV' },
    { model: 'Rush', category: 'SUV' },
    { model: 'RAV4', category: 'SUV' },
    { model: 'Land Cruiser', category: 'SUV' },
    { model: 'Hilux', category: 'Truck' },
  ],
  Mitsubishi: [
    { model: 'Mirage', category: 'Hatchback' },
    { model: 'Mirage G4', category: 'Sedan' },
    { model: 'Xpander', category: 'Van' },
    { model: 'Montero Sport', category: 'SUV' },
    { model: 'Outlander', category: 'SUV' },
    { model: 'Strada', category: 'Truck' },
    { model: 'Adventure', category: 'SUV' },
  ],
  Honda: [
    { model: 'City', category: 'Sedan' },
    { model: 'Civic', category: 'Sedan' },
    { model: 'Accord', category: 'Sedan' },
    { model: 'Brio', category: 'Hatchback' },
    { model: 'BR-V', category: 'SUV' },
    { model: 'HR-V', category: 'SUV' },
    { model: 'CR-V', category: 'SUV' },
  ],
  Nissan: [
    { model: 'Almera', category: 'Sedan' },
    { model: 'Terra', category: 'SUV' },
    { model: 'X-Trail', category: 'SUV' },
    { model: 'Patrol', category: 'SUV' },
    { model: 'Navara', category: 'Truck' },
    { model: 'Urvan', category: 'Van' },
  ],
  Ford: [
    { model: 'EcoSport', category: 'SUV' },
    { model: 'Territory', category: 'SUV' },
    { model: 'Everest', category: 'SUV' },
    { model: 'Explorer', category: 'SUV' },
    { model: 'Ranger', category: 'Truck' },
  ],
  Hyundai: [
    { model: 'Accent', category: 'Sedan' },
    { model: 'Elantra', category: 'Sedan' },
    { model: 'Stargazer', category: 'Van' },
    { model: 'Creta', category: 'SUV' },
    { model: 'Tucson', category: 'SUV' },
    { model: 'Santa Fe', category: 'SUV' },
  ],
  Kia: [
    { model: 'Picanto', category: 'Hatchback' },
    { model: 'Soluto', category: 'Sedan' },
    { model: 'Carnival', category: 'Van' },
    { model: 'Seltos', category: 'SUV' },
    { model: 'Sportage', category: 'SUV' },
  ],
  Suzuki: [
    { model: 'Swift', category: 'Hatchback' },
    { model: 'S-Presso', category: 'Hatchback' },
    { model: 'Ertiga', category: 'Van' },
    { model: 'APV', category: 'Van' },
    { model: 'XL7', category: 'SUV' },
    { model: 'Vitara', category: 'SUV' },
  ],
  Isuzu: [
    { model: 'mu-X', category: 'SUV' },
    { model: 'D-Max', category: 'Truck' },
  ],
  Chevrolet: [
    { model: 'Spin', category: 'Van' },
    { model: 'Trailblazer', category: 'SUV' },
  ],
  Mazda: [
    { model: 'Mazda2', category: 'Sedan' },
    { model: 'Mazda3', category: 'Sedan' },
    { model: 'CX-3', category: 'SUV' },
    { model: 'CX-5', category: 'SUV' },
    { model: 'BT-50', category: 'Truck' },
  ],
  Subaru: [
    { model: 'XV', category: 'SUV' },
    { model: 'Forester', category: 'SUV' },
    { model: 'Outback', category: 'SUV' },
  ],
  BMW: [
    { model: '3 Series', category: 'Sedan' },
    { model: '5 Series', category: 'Sedan' },
    { model: 'X1', category: 'SUV' },
    { model: 'X3', category: 'SUV' },
    { model: 'X5', category: 'SUV' },
  ],
  'Mercedes-Benz': [
    { model: 'C-Class', category: 'Sedan' },
    { model: 'E-Class', category: 'Sedan' },
    { model: 'GLA', category: 'SUV' },
    { model: 'GLC', category: 'SUV' },
  ],
  Volkswagen: [
    { model: 'Santana', category: 'Sedan' },
    { model: 'Lavida', category: 'Sedan' },
    { model: 'T-Cross', category: 'SUV' },
  ],
  Geely: [
    { model: 'Coolray', category: 'SUV' },
    { model: 'Azkarra', category: 'SUV' },
    { model: 'Okavango', category: 'SUV' },
  ],
  MG: [
    { model: 'MG5', category: 'Sedan' },
    { model: 'MG ZS', category: 'SUV' },
    { model: 'MG RX5', category: 'SUV' },
  ],
  GWM: [
    { model: 'Haval Jolion', category: 'SUV' },
    { model: 'Tank 300', category: 'SUV' },
    { model: 'Poer', category: 'Truck' },
  ],
  Foton: [
    { model: 'Toplander', category: 'SUV' },
    { model: 'Thunder', category: 'Truck' },
  ],
  Yamaha: [
    { model: 'Mio i 125', category: 'Motorcycle' },
    { model: 'Mio Sporty', category: 'Motorcycle' },
    { model: 'Vega Force', category: 'Motorcycle' },
    { model: 'Aerox 155', category: 'Motorcycle' },
    { model: 'NMAX', category: 'Motorcycle' },
    { model: 'Sniper 155', category: 'Motorcycle' },
    { model: 'YZF-R15', category: 'Motorcycle' },
  ],
  Kawasaki: [
    { model: 'Barako', category: 'Motorcycle' },
    { model: 'Rouser NS200', category: 'Motorcycle' },
    { model: 'KLX150', category: 'Motorcycle' },
    { model: 'Ninja 400', category: 'Motorcycle' },
  ],
  Rusi: [
    { model: 'Classic 110', category: 'Motorcycle' },
    { model: 'TC-125', category: 'Motorcycle' },
  ],
  Motorstar: [
    { model: 'Legacy 125', category: 'Motorcycle' },
    { model: 'XR150', category: 'Motorcycle' },
  ],
  Kymco: [
    { model: 'Like 125', category: 'Motorcycle' },
    { model: 'Agility', category: 'Motorcycle' },
  ],
  SYM: [
    { model: 'Jet 14', category: 'Motorcycle' },
    { model: 'Cruisym', category: 'Motorcycle' },
  ],
  Vespa: [
    { model: 'Primavera', category: 'Motorcycle' },
    { model: 'Sprint', category: 'Motorcycle' },
  ],
  Bajaj: [
    { model: 'Pulsar', category: 'Motorcycle' },
    { model: 'CT100', category: 'Motorcycle' },
  ],
  TVS: [
    { model: 'Raider 125', category: 'Motorcycle' },
    { model: 'Apache RTR', category: 'Motorcycle' },
  ],
  CFMoto: [
    { model: '300NK', category: 'Motorcycle' },
    { model: '650NK', category: 'Motorcycle' },
  ],
  'Harley-Davidson': [
    { model: 'Iron 883', category: 'Motorcycle' },
    { model: 'Street 750', category: 'Motorcycle' },
  ],
};

// Honda makes both cars and motorcycles, so it's one of the brands with
// entries in both worlds — its Model dropdown will show both.
VEHICLE_DATA.Honda.push(
  { model: 'Click 125i', category: 'Motorcycle' },
  { model: 'Beat', category: 'Motorcycle' },
  { model: 'ADV 160', category: 'Motorcycle' },
  { model: 'PCX 160', category: 'Motorcycle' },
  { model: 'XRM 125', category: 'Motorcycle' },
  { model: 'TMX 125', category: 'Motorcycle' },
  { model: 'Wave 110i', category: 'Motorcycle' },
  { model: 'CBR150R', category: 'Motorcycle' },
  { model: 'CB150R', category: 'Motorcycle' }
);

// Suzuki also makes both — add its motorcycle lineup alongside its cars.
VEHICLE_DATA.Suzuki.push(
  { model: 'Raider R150', category: 'Motorcycle' },
  { model: 'Skydrive', category: 'Motorcycle' },
  { model: 'Smash', category: 'Motorcycle' },
  { model: 'Burgman Street', category: 'Motorcycle' }
);

export const ALL_CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Van', 'Truck', 'Coupe', 'Motorcycle'];

// Car body types ordered by roughly how common they are in the Philippine
// market (sedans and small SUVs/MPVs dominate; coupes are rare). Used to
// order the Category dropdown instead of alphabetically.
export const CAR_CATEGORIES_ORDERED = ['Sedan', 'SUV', 'Van', 'Hatchback', 'Truck', 'Coupe'];

// Brands ordered by roughly their popularity/market share in the Philippines,
// used for the Brand dropdown instead of alphabetical order.
export const CAR_BRAND_ORDER = [
  'Toyota', 'Mitsubishi', 'Ford', 'Nissan', 'Honda', 'Suzuki',
  'Hyundai', 'Kia', 'Isuzu', 'Chevrolet', 'Mazda', 'Subaru',
  'Geely', 'MG', 'GWM', 'Foton', 'BMW', 'Mercedes-Benz', 'Volkswagen',
];

export const MOTO_BRAND_ORDER = [
  'Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Rusi', 'Motorstar',
  'Kymco', 'SYM', 'TVS', 'Bajaj', 'Vespa', 'CFMoto', 'Harley-Davidson',
];
