// Common Philippine valid IDs, grouped by whether the back of the card
// carries real verification info (address, restrictions, QR code) or is
// blank/irrelevant — sides: 2 asks for a back photo too, sides: 1 doesn't.
export const VALID_ID_TYPES = [
  { value: 'drivers_license', label: "Driver's License", sides: 2 },
  { value: 'national_id', label: 'Philippine National ID (PhilSys/PhilID)', sides: 2 },
  { value: 'umid', label: 'UMID', sides: 2 },
  { value: 'postal_id', label: 'Postal ID', sides: 2 },
  { value: 'passport', label: 'Philippine Passport', sides: 1 },
  { value: 'prc_id', label: 'PRC ID', sides: 1 },
  { value: 'sss_id', label: 'SSS ID', sides: 1 },
  { value: 'tin_id', label: 'TIN ID', sides: 1 },
  { value: 'voters_id', label: "Voter's ID / Certification", sides: 1 },
  { value: 'senior_citizen_id', label: 'Senior Citizen ID', sides: 1 },
  { value: 'pwd_id', label: 'PWD ID', sides: 1 },
  { value: 'other', label: 'Other government-issued ID', sides: 1 },
];

export const idTypeNeedsBack = (value) => VALID_ID_TYPES.find((t) => t.value === value)?.sides === 2;
