export class Dispatcher {
  // persistTrip simulates a slow async step (database write, push notification)
  constructor(index, { persistTrip = async () => {} } = {}) {
    this.index = index;               // GridIndex holding AVAILABLE drivers only
    this.persistTrip = persistTrip;
    this.requests = new Map();        // requestId -> record (idempotency)
    this.queue = [];                  // FIFO of records waiting for a driver
    this.trips = new Map();           // tripId -> trip
    this.busy = new Map();            // driverId -> { position, tripId }
    this.nextTripId = 1;
  }

  addDriver(driverId, position) {
    this.index.upsert(driverId, position);
    this.drain();
  }

  async requestRide(requestId, rider) {
    let rec = this.requests.get(requestId);
    // No await between this check and the set below, so two calls with the
    // same requestId can never both get past it.
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
    if (!trip) return;
    const { position } = this.busy.get(trip.driverId);
    this.busy.delete(trip.driverId);
    this.index.upsert(trip.driverId, endPosition ?? position);
    this.drain(); // a driver freed up: retry the queue
  }

  // Match waiting riders to drivers, oldest first. Fully synchronous.
  drain() {
    while (this.queue.length > 0) {
      const rec = this.queue[0];
      const [best] = this.index.nearest(rec.rider, 1);
      if (!best) return;              // no driver now; head of the line waits
      this.queue.shift();
      this.assign(rec, best.id);
    }
  }

  assign(rec, driverId) {
    // CLAIM the driver in the same tick as nearest(): remove from the index
    // BEFORE any await, so nobody else can see this driver as available.
    const d = this.index.drivers.get(driverId);
    const position = { latitude: d.latitude, longitude: d.longitude };
    this.index.remove(driverId);

    const trip = { id: `t${this.nextTripId++}`, requestId: rec.requestId, driverId, rider: rec.rider };
    this.trips.set(trip.id, trip);
    this.busy.set(driverId, { position, tripId: trip.id });
    rec.trip = trip;
    rec.status = "assigning";

    // The slow part happens AFTER the claim.
    rec.persisting = (async () => {
      try {
        await this.persistTrip(trip);
        rec.status = "matched";
      } catch {
        // Roll back: free the driver and mark the request failed
        this.trips.delete(trip.id);
        this.busy.delete(driverId);
        rec.trip = null;
        rec.status = "failed";
        this.index.upsert(driverId, position);
        this.drain();
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