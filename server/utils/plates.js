// Two vehicles cannot carry the same plate.
//
// Nothing enforced this. The Add Vehicle form checked the field was not
// empty and stopped there, the Edit drawer checked nothing, and the
// database had no constraint — so the system happily held a Toyota Avanza
// and a Nissan Almera both reading ABC 1237. A plate is how a vehicle is
// identified at the counter, on its OR/CR and in a police stop; two
// vehicles sharing one makes every record that mentions it ambiguous.

// What two plates have to differ by to be different plates. Spacing,
// punctuation and case are how the same plate gets typed twice —
// "ABC 1234", "abc-1234" and "ABC1234" are one vehicle, not three.
export const plateKey = (plate) => String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// The vehicle already using this plate, or null.
//
// A blank plate never clashes: vehicles added before the field existed
// have none on file, and refusing to save one of those because another is
// also blank would make them uneditable. Archived vehicles are not
// counted — a retired vehicle should not hold its plate hostage, and in
// practice a plate does get re-entered when a record is replaced.
export function plateClash(plate, cars, selfId = null) {
  const key = plateKey(plate);
  if (!key) return null;
  return cars.find((car) => (
    String(car._id) !== String(selfId)
    && car.archived !== true
    && plateKey(car.plateNumber) === key
  )) || null;
}

export const plateClashMessage = (car) =>
  `Plate ${car.plateNumber} is already on ${car.brand} ${car.model}. `
  + 'Two vehicles cannot share a plate — check the plate, or edit the other vehicle if this one has taken it over.';
