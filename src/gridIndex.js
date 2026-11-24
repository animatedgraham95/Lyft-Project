import { haversineDistance } from "./distanceFormula.js";

const Meters_Per_Degrees = 111_320;

export class GridIndex {
  constructor(reflat, cellMeters = 1000) {
    this.cellMeters = cellMeters;
    this.Meters_Per_Degrees_Latutide = Meters_Per_Degrees;
    this.Meters_Per_Degrees_Longitude =
      Meters_Per_Degrees * Math.cos((reflat * Math.PI) / 180);
    this.cells = new Map();
    this.drivers = new Map();
  }

  _cell(latitude, longitude) {
    return [
      Math.floor((latitude * this.Meters_Per_Degrees_Latutide) / this.cellMeters),
      Math.floor((longitude * this.Meters_Per_Degrees_Longitude) / this.cellMeters),
    ];
  }

  static _key(row, column) {
    return `${row},${column}`;
  }

  _removeFromBucket(key, driverId) {
    const bucket = this.cells.get(key);
    if (!bucket) return;
    bucket.delete(driverId);
    if (bucket.size === 0) this.cells.delete(key);
  }

  upsert(driverId, { latitude, longitude }) {
    const [row, col] = this._cell(latitude, longitude);
    const key = GridIndex._key(row, col);
    const old = this.drivers.get(driverId);

    if (old && old.key !== key) this._removeFromBucket(old.key, driverId);

    if (!this.cells.has(key)) this.cells.set(key, new Set());
    this.cells.get(key).add(driverId);
    this.drivers.set(driverId, { latitude, longitude, key });
  }

  remove(driverId) {
    const old = this.drivers.get(driverId);
    if (!old) return;
    this._removeFromBucket(old.key, driverId);
    this.drivers.delete(driverId);
  }

  static *_ring(cr, cc, r) {
    if (r === 0) {
      yield [cr, cc];
      return;
    }
    for (let dc = -r; dc <= r; dc++) {
      yield [cr - r, cc + dc];
      yield [cr + r, cc + dc];
    }
    for (let dr = -r + 1; dr < r; dr++) {
      yield [cr + dr, cc - r];
      yield [cr + dr, cc + r];
    }
  }

  nearest(rider, k = 5, maxRadiusM = 10_000) {
    const [cr, cc] = this._cell(rider.latitude, rider.longitude);
    const maxRing = Math.floor(maxRadiusM / this.cellMeters) + 1;
    const found = [];

    for (let r = 0; r <= maxRing; r++) {
      for (const [row, col] of GridIndex._ring(cr, cc, r)) {
        const bucket = this.cells.get(GridIndex._key(row, col));
        if (!bucket) continue;

        for (const id of bucket) {
          const d = this.drivers.get(id);
          const distM = haversineDistance(rider, d) * 1000;
          found.push({ dist: distM, id });
        }
      }

      if (found.length >= k) {
        found.sort((a, b) => a.dist - b.dist);
        if (found[k - 1].dist <= r * this.cellMeters) break;
      }
    }

    found.sort((a, b) => a.dist - b.dist);
    return found.slice(0, k).filter((f) => f.dist <= maxRadiusM);
  }
}