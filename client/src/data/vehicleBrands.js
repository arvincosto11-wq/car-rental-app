// Popular car and motorcycle brands/models in the Philippines, used to power
// the Brand/Model dropdowns on the admin Add Car form. Not exhaustive —
// "Other" is always available so admin can type anything not listed here.

export const CAR_BRANDS_MODELS = {
  Toyota: ['Vios', 'Wigo', 'Avanza', 'Innova', 'Fortuner', 'Rush', 'Hilux', 'Corolla Altis', 'Camry', 'RAV4', 'Land Cruiser', 'Hiace'],
  Mitsubishi: ['Mirage', 'Mirage G4', 'Xpander', 'Montero Sport', 'Strada', 'Adventure', 'Outlander'],
  Honda: ['City', 'Civic', 'CR-V', 'BR-V', 'Brio', 'HR-V', 'Accord'],
  Nissan: ['Almera', 'Navara', 'Terra', 'X-Trail', 'Patrol', 'Urvan'],
  Ford: ['Ranger', 'Everest', 'EcoSport', 'Territory', 'Explorer'],
  Hyundai: ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta', 'Stargazer'],
  Kia: ['Picanto', 'Soluto', 'Seltos', 'Sportage', 'Carnival'],
  Suzuki: ['Ertiga', 'Swift', 'Vitara', 'S-Presso', 'XL7', 'APV'],
  Isuzu: ['D-Max', 'mu-X'],
  Chevrolet: ['Trailblazer', 'Spin'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-3', 'CX-5', 'BT-50'],
  Subaru: ['XV', 'Forester', 'Outback'],
  BMW: ['3 Series', '5 Series', 'X1', 'X3', 'X5'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLA', 'GLC'],
  Volkswagen: ['Santana', 'Lavida', 'T-Cross'],
  Geely: ['Coolray', 'Okavango', 'Azkarra'],
  MG: ['MG5', 'MG ZS', 'MG RX5'],
  GWM: ['Tank 300', 'Haval Jolion', 'Poer'],
  Foton: ['Toplander', 'Thunder'],
};

export const MOTO_BRANDS_MODELS = {
  Honda: ['Click 125i', 'Beat', 'ADV 160', 'PCX 160', 'XRM 125', 'TMX 125', 'Wave 110i', 'CBR150R', 'CB150R'],
  Yamaha: ['Mio i 125', 'Mio Sporty', 'Aerox 155', 'NMAX', 'Sniper 155', 'YZF-R15', 'Vega Force'],
  Suzuki: ['Raider R150', 'Skydrive', 'Smash', 'Burgman Street'],
  Kawasaki: ['Barako', 'KLX150', 'Ninja 400', 'Rouser NS200'],
  Rusi: ['Classic 110', 'TC-125'],
  Motorstar: ['Legacy 125', 'XR150'],
  Kymco: ['Like 125', 'Agility'],
  SYM: ['Jet 14', 'Cruisym'],
  Vespa: ['Primavera', 'Sprint'],
  Bajaj: ['Pulsar', 'CT100'],
  TVS: ['Raider 125', 'Apache RTR'],
  CFMoto: ['300NK', '650NK'],
  'Harley-Davidson': ['Iron 883', 'Street 750'],
};

export const CAR_CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Van', 'Truck', 'Coupe'];
export const MOTORCYCLE_CATEGORY = 'Motorcycle';
export const ALL_CATEGORIES = [...CAR_CATEGORIES, MOTORCYCLE_CATEGORY];
