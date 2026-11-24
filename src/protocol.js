const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

const isId = (v) => typeof v === "string" && ID_RE.test(v);
const isNum = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const hasKeys = (msg, keys) => Object.keys(msg).every((k) => keys.includes(k));

const validators = {
  hello(m) {
    if (!hasKeys(m, ["type", "role", "id"])) return "unexpected field";
    if (m.role !== "driver" && m.role !== "rider") return "role must be 'driver' or 'rider'";
    if (!isId(m.id)) return "id must be 1-64 characters: letters, digits, _ . -";
    return null;
  },
  "driver.location"(m) {
    if (!hasKeys(m, ["type", "latitude", "longitude"])) return "unexpected field";
    if (!isNum(m.latitude, -90, 90)) return "latitude must be a number from -90 to 90";
    if (!isNum(m.longitude, -180, 180)) return "longitude must be a number from -180 to 180";
    return null;
  },
  "ride.request"(m) {
    if (!hasKeys(m, ["type", "requestId", "latitude", "longitude"])) return "unexpected field";
    if (!isId(m.requestId)) return "requestId must be 1-64 characters: letters, digits, _ . -";
    if (!isNum(m.latitude, -90, 90)) return "latitude must be a number from -90 to 90";
    if (!isNum(m.longitude, -180, 180)) return "longitude must be a number from -180 to 180";
    return null;
  },
  "trip.complete"(m) {
    if (!hasKeys(m, ["type", "tripId"])) return "unexpected field";
    if (!isId(m.tripId)) return "tripId must be 1-64 characters: letters, digits, _ . -";
    return null;
  },
};

// Returns { ok: true, msg } or { ok: false, code, message }
export function parseMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return { ok: false, code: "bad_json", message: "message is not valid JSON" };
  }
  if (msg === null || typeof msg !== "object" || Array.isArray(msg)) {
    return { ok: false, code: "bad_message", message: "message must be a JSON object" };
  }
  if (typeof msg.type !== "string" || !Object.hasOwn(validators, msg.type)) {
    return { ok: false, code: "unknown_type", message: "unknown message type" };
  }
  const problem = validators[msg.type](msg);
  if (problem) return { ok: false, code: "invalid_field", message: problem };
  return { ok: true, msg };
}