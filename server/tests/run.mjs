// Every rule this system charges people money by, checked without a
// database, a browser or a payment.
//
//     npm test          (from the server folder)
//
// Add a check whenever a money or availability rule changes, and whenever a
// bug gets out — the reproduction that found it is the test that stops it
// coming back.

import { report } from './harness.mjs';
import phTime from './phTime.test.mjs';
import availability from './availability.test.mjs';
import pricing from './pricing.test.mjs';
import longRental from './longRental.test.mjs';
import refunds from './refunds.test.mjs';
import adjustOffer from './adjustOffer.test.mjs';

const suites = [phTime, availability, pricing, longRental, refunds, adjustOffer];

for (const run of suites) run();

process.exit(report());
