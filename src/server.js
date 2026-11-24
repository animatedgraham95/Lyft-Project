import { WebSocketServer } from "ws";
import { GridIndex } from "./gridIndex.js";
import { Dispatcher } from "./dispatcher.js";
import { parseMessage } from "./protocol.js";

const send = (ws, obj) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
};
const sendError = (ws, code, message) => send(ws, { type: "error", code, message });

export function createServer({ port = 8080, refLat = 37.77, persistTrip } = {}) {
  const drivers = new Map();       // driverId -> ws
  const riders = new Map();        // riderId  -> ws
  const requestOwner = new Map();  // requestId -> riderId

  const dispatcher = new Dispatcher(new GridIndex(refLat), {
    persistTrip,
    onTripUpdate: (u) => {
      const update = { type: "trip.update", ...u };
      const riderWs = riders.get(requestOwner.get(u.requestId));
      if (riderWs) send(riderWs, update);
      const driverWs = u.driverId && drivers.get(u.driverId);
      if (driverWs) send(driverWs, update);
    },
  });

  const wss = new WebSocketServer({ port, maxPayload: 4096 });

  wss.on("connection", (ws) => {
    ws.session = null;
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));

    ws.on("message", async (raw) => {
      const parsed = parseMessage(raw);
      if (!parsed.ok) return sendError(ws, parsed.code, parsed.message);
      const msg = parsed.msg;

      if (msg.type === "hello") {
        if (ws.session) return sendError(ws, "already_identified", "hello was already sent");
        const table = msg.role === "driver" ? drivers : riders;
        const old = table.get(msg.id);
        if (old && old !== ws) old.close(4000, "replaced by a new connection");
        table.set(msg.id, ws);
        ws.session = { role: msg.role, id: msg.id };
        return send(ws, { type: "hello.ok", role: msg.role, id: msg.id });
      }
      if (!ws.session) return sendError(ws, "not_identified", "send hello first");

      const { role, id } = ws.session;

      if (msg.type === "driver.location") {
        if (role !== "driver") return sendError(ws, "wrong_role", "only drivers send driver.location");
        dispatcher.addDriver(id, msg);
        return;
      }

      if (msg.type === "ride.request") {
        if (role !== "rider") return sendError(ws, "wrong_role", "only riders send ride.request");
        const owner = requestOwner.get(msg.requestId);
        if (owner && owner !== id) return sendError(ws, "request_id_taken", "requestId belongs to another rider");
        requestOwner.set(msg.requestId, id);
        const result = await dispatcher.requestRide(msg.requestId, { latitude: msg.latitude, longitude: msg.longitude });
        return send(ws, { type: "ride.accepted", requestId: result.requestId, status: result.status });
      }

      if (msg.type === "trip.complete") {
        if (role !== "driver") return sendError(ws, "wrong_role", "only drivers send trip.complete");
        const trip = dispatcher.trips.get(msg.tripId);
        if (!trip || trip.driverId !== id) return sendError(ws, "unknown_trip", "no such trip for this driver");
        dispatcher.completeTrip(msg.tripId);
      }
    });

    ws.on("close", () => {
      const s = ws.session;
      if (!s) return;
      const table = s.role === "driver" ? drivers : riders;
      if (table.get(s.id) !== ws) return;
      table.delete(s.id);
      if (s.role === "driver") dispatcher.removeDriver(s.id);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  heartbeat.unref();

  return {
    wss,
    dispatcher,
    get port() { return wss.address().port; },
    close: () => new Promise((resolve) => {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close(resolve);
    }),
  };
}