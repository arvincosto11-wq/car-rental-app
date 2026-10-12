// What to say when something fails in a way nobody wrote a message for.
//
// Every route used to end `catch (err) { res.status(500).json({ message:
// err.message }) }`, which sent the database's own words to whoever asked.
// Type a malformed id into the address bar and the answer came back "Cast
// to ObjectId failed for value "abc" at path "_id" for model "Driver"" —
// which names a collection, says the shape of our ids, tells an attacker
// the stack is MongoDB, and calls a bad request a server fault while it is
// at it.
//
// It also threw away the one thing that mattered: nothing was logged, so a
// real fault left no trace anywhere except the browser of whoever hit it.
//
// Three failures are worth answering properly and the rest are ours.

// Mongoose's name for "that is not an id". It cannot match anything, so it
// is a 404 rather than a 500: the thing genuinely is not there.
const isBadId = (err) => err?.name === 'CastError';

// Required fields missing, enums not matched. The field names are worth
// saying — they are the names on the form the person just filled in — but
// the rest of Mongoose's sentence is not.
const missingFields = (err) => Object.keys(err?.errors || {});

export function fail(res, err) {
  if (isBadId(err)) {
    return res.status(404).json({ message: 'Not found.' });
  }

  if (err?.name === 'ValidationError') {
    const fields = missingFields(err);
    return res.status(400).json({
      message: fields.length
        ? `Please check these and try again: ${fields.join(', ')}.`
        : 'Some of those details are missing or not valid.',
    });
  }

  // A unique index speaking. Routes that know WHICH thing is duplicated
  // catch this themselves and say so; this is the fallback for the ones
  // that do not.
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'That already exists.' });
  }

  // Anything else is a fault on our side. The person gets a sentence they
  // can act on; the detail goes to the server log, where it is of some use.
  console.error('Unhandled route error:', err);
  return res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
}
