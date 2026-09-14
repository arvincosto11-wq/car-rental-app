// Client for the AIKA/AKSH GPS tracker platform (en.aika168.com) — there's
// no official developer API, so this replicates the same login + polling
// flow the AKSH mobile app itself uses (confirmed working, real device
// field names, etc. cross-checked against the open-source "obdtracker"
// Python library, an independent reverse-engineering of the same
// platform). Runs from our own server on demand (see GET /cars/gps-fleet)
// rather than needing the tracker itself reconfigured or any new hosting —
// this is just a couple of outgoing HTTP calls.

const APP_KEY = '7DU2DJFDR8321';
const DEFAULT_SERVER = 'http://www.aika168.com';

// The real API host isn't fixed — the platform tells you where to send
// requests via this discovery endpoint, which just returns the address as
// plain text (not JSON).
async function discoverApiAddress() {
  const res = await fetch(`${DEFAULT_SERVER}/getapp.aspx`);
  if (!res.ok) throw new Error(`AIKA discovery failed: HTTP ${res.status}`);
  const text = await res.text();
  return text.trim();
}

// Responses are XML with the actual JSON payload sitting as the root
// element's text content (an ASP.NET web-service quirk) — a real example:
// `<?xml version="1.0" encoding="utf-8"?>\n<string xmlns="...">{"state":"0",...}</string>`.
// Two tags precede the JSON (the xml prolog, then <string>), so stripping
// just one leading tag leaves "<string ...>{...}" and breaks JSON.parse —
// simplest robust fix is to not parse the XML shape at all, just grab
// everything between the first `{` and the last `}`.
function unwrapXmlJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`AIKA response did not contain JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callApi(apiAddress, requestName, payload) {
  const res = await fetch(`${apiAddress}/${requestName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
  });
  if (!res.ok) throw new Error(`AIKA ${requestName} failed: HTTP ${res.status}`);
  return unwrapXmlJson(await res.text());
}

// Logs in with the tracker's own "ID Number"/serial (shown in the AKSH
// app/web dashboard) as the username — same as logging in as an
// "individual user" per the tracker's manual. The login response hands
// back a *different* internal deviceID (e.g. "3237204", not the serial we
// logged in with) — that internal ID is what GetTracking/GetDeviceStatus
// actually expect, confirmed by testing against the real device rather
// than assumed from the reference library alone.
async function aikaLogin(loginSerial, password) {
  const apiAddress = await discoverApiAddress();
  const data = await callApi(apiAddress, 'Login', {
    Name: loginSerial,
    Pass: password,
    LoginType: 1,
    LoginAPP: 'AKSH',
    GMT: '8:00',
    Key: APP_KEY,
  });
  const sessionKey = data?.deviceInfo?.key2018;
  const internalDeviceId = data?.deviceInfo?.deviceID;
  const model = data?.deviceInfo?.model;
  if (!sessionKey || !internalDeviceId) {
    throw new Error('AIKA login did not return a session key/device ID — check the device ID and password.');
  }
  return { apiAddress, sessionKey, internalDeviceId, model };
}

// GetTracking's own response already includes an "ACC ON"/"ACC OFF"
// status string alongside the location fields (confirmed on the real
// device), so a separate GetDeviceStatus call turned out to be
// redundant for what we actually need — dropped it, one less request
// and one less thing that can fail.
async function aikaGetTracking(apiAddress, sessionKey, deviceId, model) {
  const data = await callApi(apiAddress, 'GetTracking', {
    DeviceID: deviceId,
    // Despite the device's own "Type: AK" label, this field is the
    // *numeric* model code from the login response (e.g. "71") — passing
    // the "AK" prefix instead throws a server-side type-conversion error.
    Model: model,
    TimeZones: '8:00',
    MapType: 'Google',
    Language: 'en',
    Key: sessionKey,
  });
  const statusText = (data.status || '').toLowerCase();
  return {
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lng),
    speed: parseFloat(data.speed) || 0,
    ignitionOn: statusText.includes('acc on'),
  };
}

// Full login -> location round trip, returned in the same shape Car.gps
// already uses (see models/Car.js) so the caller can drop it straight in.
// No session caching — this is a low-traffic admin/consignor dashboard,
// not worth the complexity yet.
//
// Returns null (not an error) when the device hasn't gotten a real fix
// yet — it reports its own "no data" sentinel as lat/lng exactly -1, -1
// (a real point in the Gulf of Guinea, nowhere near where any of our cars
// actually are), so treating that as a valid position would put a bogus
// pin on the map instead of just leaving the car on its last known
// (or placeholder) position until a real fix comes in.
export async function fetchAikaGps(loginSerial, password) {
  const { apiAddress, sessionKey, internalDeviceId, model } = await aikaLogin(loginSerial, password);
  const tracking = await aikaGetTracking(apiAddress, sessionKey, internalDeviceId, model);
  if (tracking.lat === -1 && tracking.lng === -1) return null;
  return {
    lat: tracking.lat,
    lng: tracking.lng,
    speed: tracking.speed,
    ignitionOn: tracking.ignitionOn,
    updatedAt: new Date(),
  };
}
