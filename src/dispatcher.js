export class Dispatcher {
  constructor(index, { persistTrip = async () => {}, onTripUpdate = () => {} } = {}) {
    this.index = index;
    this.persistTrip = persistTrip;
    this.onTripUpdate = onTripUpdate;
    this.requests = new Map();
    this.queue = [];
    this.trips = new Map();
    this.busy = new Map();
    this.offline = new Set();
    this.nextTripId = 1;
  }

  addDriver(driverId, position) {
    this.offline.delete(driverId);
    const busy = this.busy.get(driverId);
    if (busy) {
      busy.position = { latitude: position.latitude, longitude: position.longitude };
      return;
    }
    this.index.upsert(driverId, position);
    this.drain();
  }

  removeDriver(driverId) {
    if (this.busy.has(driverId)) this.offline.add(driverId);
    else this.index.remove(driverId);
  }

  async requestRide(requestId, rider) {
    let rec = this.requests.get(requestId);
    if (!rec) {
      rec = { requestId, rider, status: "queued", trip: null, persisting: null };
      this.requests.set(requestId, rec);
      this.queue.push(rec);
      this.drain();
    }
    if (rec.persisting) await rec.persisting;
    return this.view(rec);
  }

  getRequest(requestId) {
    const rec = this.requests.get(requestId);
    return rec ? this.view(rec) : null;
  }

  completeTrip(tripId, endPosition) {
    const trip = this.trips.get(tripId);
    if (!trip || trip.completed) return false;
    trip.completed = true;
    const { position } = this.busy.get(trip.driverId);
    this.busy.delete(trip.driverId);
    const rec = this.requests.get(trip.requestId);
    rec.status = "completed";
    this.onTripUpdate(this.view(rec));
    if (this.offline.has(trip.driverId)) {
      this.offline.delete(trip.driverId);
    } else {
      this.index.upsert(trip.driverId, endPosition ?? position);
      this.drain();
    }
    return true;
  }

  drain() {
    while (this.queue.length > 0) {
      const rec = this.queue[0];
      const [best] = this.index.nearest(rec.rider, 1);
      if (!best) return;
      this.queue.shift();
      this.assign(rec, best.id);
    }
  }

  assign(rec, driverId) {
    // Claim the driver in the same tick as nearest(), before any await
    const d = this.index.drivers.get(driverId);
    const position = { latitude: d.latitude, longitude: d.longitude };
    this.index.remove(driverId);

    const trip = { id: `t${this.nextTripId++}`, requestId: rec.requestId, driverId, rider: rec.rider, completed: false };
    this.trips.set(trip.id, trip);
    this.busy.set(driverId, { position, tripId: trip.id });
    rec.trip = trip;
    rec.status = "assigning";

    rec.persisting = (async () => {
      try {
        await this.persistTrip(trip);
        rec.status = "matched";
        this.onTripUpdate(this.view(rec));
      } catch {
        this.trips.delete(trip.id);
        this.busy.delete(driverId);
        rec.trip = null;
        rec.status = "failed";
        this.onTripUpdate({ requestId: rec.requestId, tripId: null, driverId, status: "failed" });
        if (!this.offline.delete(driverId)) {
          this.index.upsert(driverId, position);
          this.drain();
        }
      } finally {
        rec.persisting = null;
      }
    })();
  }

  view(rec) {
    return {
      requestId: rec.requestId,
      status: rec.status,
      tripId: rec.trip?.id ?? null,
      driverId: rec.trip?.driverId ?? null,
    };
  }
}