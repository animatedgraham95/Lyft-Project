import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistance } from '../src/distanceFormula.js';
import {states, nextRideState} from '../src/tripLogic.js';
import { GridIndex } from '../src/gridIndex.js';
import { Dispatcher } from "../src/dispatcher.js";

function assertClose(actual, expected, tolerance) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('setup works', () => {
  assert.equal(1 + 1, 2);
});

test('identical points return 0', () => {
  assert.equal(haversineDistance({latitude:37.7749, longitude:-122.4194}, {latitude:37.7749, longitude:-122.4194}), 0);
});
test('San Francisco to Los Angeles is about 559 km', () => {
  const km = haversineDistance({latitude:37.7749, longitude:-122.4194}, {latitude:34.0522, longitude:-118.2437});
  assertClose(km, 559.1, 0.5);
});

test('is symmetric', () => {
  const sf = { latitude: 37.7749, longitude: -122.4194 };
  const la = { latitude: 34.0522, longitude: -118.2437 };
  assertClose(haversineDistance(sf, la), haversineDistance(la, sf), 1e-9);
});

test('one degree of latitude is about 111.19 km', () => {
  assertClose(
    haversineDistance({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }),
    111.19,
    0.01
  );
});

test('works across the international date line', () => {
  assertClose(
    haversineDistance({ latitude: 0, longitude: 179 }, { latitude: 0, longitude: -179 }),
    222.39,
    0.01
  );
});

const validTransitions = [
  [states.REQUESTING, 'driverMatched', states.MATCHED],
  [states.REQUESTING, 'noDriverFound', states.NO_DRIVER],
  [states.REQUESTING, 'rideCancelled', states.CANCELLED],
  [states.MATCHED, 'tripStarted', states.IN_PROGRESS],
  [states.MATCHED, 'rideCancelled', states.CANCELLED],
  [states.IN_PROGRESS, 'tripCompleted', states.COMPLETED],
  [states.IN_PROGRESS, 'rideCancelled', states.CANCELLED],
];

const invalidTransitions = [
  [states.REQUESTING, 'tripStarted'],
  [states.REQUESTING, 'tripCompleted'],
  [states.MATCHED, 'tripCompleted'],
  [states.MATCHED, 'noDriverFound'],
  [states.COMPLETED, 'rideCancelled'],
  [states.NO_DRIVER, 'driverMatched'],
  [states.CANCELLED, 'driverMatched'],
];

test('all valid transitions work', () => {
  for (const [from, event, expected] of validTransitions) {
    assert.equal(nextRideState(from, event), expected);
  }
});

test('all invalid transitions throw', () => {
  for (const [from, event] of invalidTransitions) {
    assert.throws(() => nextRideState(from, event), /Invalid transition/);
  }
});
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(12345);

// San Francisco bounding box
const LAT_MIN = 37.70, LAT_MAX = 37.82;
const LON_MIN = -122.52, LON_MAX = -122.36;
const randomPoint = () => ({
  latitude: LAT_MIN + rand() * (LAT_MAX - LAT_MIN),
  longitude: LON_MIN + rand() * (LON_MAX - LON_MIN),
});

// The slow, obviously-correct version: measure every driver
function bruteForce(drivers, rider, k, maxRadiusM) {
  const all = [];
  for (const [id, d] of drivers) {
    all.push({ dist: haversineDistance(rider, d) * 1000, id });
  }
  all.sort((a, b) => a.dist - b.dist);
  return all.slice(0, k).filter((f) => f.dist <= maxRadiusM);
}

// Compare by distance, not id, so exact ties can't cause false alarms
function sameResult(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => Math.abs(x.dist - b[i].dist) < 1e-6);
}

function runTest(name, { driverCount, riderCount, k, maxRadiusM, cellM = 1000 }) {
  const idx = new GridIndex(37.77, cellM);
  const truth = new Map();
  for (let i = 0; i < driverCount; i++) {
    const p = randomPoint();
    idx.upsert(`d${i}`, p);
    truth.set(`d${i}`, p);
  }

  let mismatches = 0;
  const examples = [];
  for (let i = 0; i < riderCount; i++) {
    const rider = randomPoint();
    const got = idx.nearest(rider, k, maxRadiusM);
    const want = bruteForce(truth, rider, k, maxRadiusM);
    if (!sameResult(got, want)) {
      mismatches++;
      if (examples.length < 3) examples.push({ rider, got, want });
    }
  }
  console.log(
    `${mismatches === 0 ? "PASS" : "FAIL"}  ${name}: ${riderCount} riders, ` +
      `${driverCount} drivers, k=${k}, cell=${cellM}m, mismatches=${mismatches}`
  );
  if (examples.length) console.log(JSON.stringify(examples[0], null, 1));
  return mismatches;
}

let total = 0;
total += runTest("dense city",        { driverCount: 3000, riderCount: 5000, k: 5,  maxRadiusM: 10_000 });
total += runTest("sparse city",       { driverCount: 40,   riderCount: 5000, k: 3,  maxRadiusM: 10_000 });
total += runTest("k = 1",             { driverCount: 1000, riderCount: 5000, k: 1,  maxRadiusM: 10_000 });
total += runTest("large k",           { driverCount: 1000, riderCount: 3000, k: 20, maxRadiusM: 10_000 });
total += runTest("small radius cap",  { driverCount: 500,  riderCount: 5000, k: 5,  maxRadiusM: 1_500 });
total += runTest("500 m cells",       { driverCount: 2000, riderCount: 5000, k: 5,  maxRadiusM: 10_000, cellM: 500 });

// Moving and removing drivers
{
  const idx = new GridIndex(37.77);
  const truth = new Map();
  for (let i = 0; i < 2000; i++) {
    const p = randomPoint();
    idx.upsert(`d${i}`, p); truth.set(`d${i}`, p);
  }
  for (let step = 0; step < 6000; step++) {
    const id = `d${Math.floor(rand() * 2000)}`;
    if (rand() < 0.2) {
      idx.remove(id); truth.delete(id);
    } else {
      const p = randomPoint();
      idx.upsert(id, p); truth.set(id, p);
    }
  }
  let bad = 0;
  for (let i = 0; i < 3000; i++) {
    const rider = randomPoint();
    if (!sameResult(idx.nearest(rider, 5, 10_000), bruteForce(truth, rider, 5, 10_000))) bad++;
  }
  console.log(`${bad === 0 ? "PASS" : "FAIL"}  after moves and removals: 3000 riders, mismatches=${bad}`);
  total += bad;
}

// Speed comparison
{
  const idx = new GridIndex(37.77);
  const truth = new Map();
  for (let i = 0; i < 20000; i++) {
    const p = randomPoint();
    idx.upsert(`d${i}`, p); truth.set(`d${i}`, p);
  }
  const riders = Array.from({ length: 1000 }, randomPoint);
  let t = performance.now();
  for (const r of riders) idx.nearest(r, 5);
  const gridMs = performance.now() - t;
  t = performance.now();
  for (const r of riders) bruteForce(truth, r, 5, 10_000);
  const bruteMs = performance.now() - t;
  console.log(`\nSpeed, 20000 drivers, 1000 searches: grid ${gridMs.toFixed(0)} ms, brute force ${bruteMs.toFixed(0)} ms`);
}

console.log(total === 0 ? "\nAll tests passed." : `\n${total} total mismatches.`);


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => sleep(Math.random() * 10);
const near = (i) => ({ latitude: 37.77 + i * 0.0005, longitude: -122.42 });

function makeDispatcher(opts) {
  return new Dispatcher(new GridIndex(37.77), { persistTrip: jitter, ...opts });
}

// ---- 1. The bug, on purpose: await between "find driver" and "claim driver"
{
  const index = new GridIndex(37.77);
  for (let i = 0; i < 3; i++) index.upsert(`d${i}`, near(i));
  const assigned = [];
  async function naiveRequest(rider) {
    const [best] = index.nearest(rider, 1);
    if (!best) return;
    await jitter();                 // e.g. DB write: other requests run here
    index.remove(best.id);          // too late, others already chose this driver
    assigned.push(best.id);
  }
  await Promise.all(Array.from({ length: 20 }, () => naiveRequest(near(1))));
  const counts = {};
  for (const id of assigned) counts[id] = (counts[id] ?? 0) + 1;
  const doubled = Object.values(counts).filter((n) => n > 1).length;
  console.log(`NAIVE   (await before claim): ${assigned.length} trips for 3 drivers, ${doubled} driver(s) double-booked`);
  assert.ok(doubled > 0, "expected the naive version to double-book");
}

// ---- 2. Real dispatcher: no double-booking
{
  const disp = makeDispatcher();
  for (let i = 0; i < 3; i++) disp.addDriver(`d${i}`, near(i));
  const results = await Promise.all(
    Array.from({ length: 50 }, (_, i) => disp.requestRide(`r${i}`, near(i % 5)))
  );
  const matched = results.filter((r) => r.status === "matched");
  const queued = results.filter((r) => r.status === "queued");
  assert.equal(matched.length, 3);
  assert.equal(queued.length, 47);
  assert.equal(new Set(matched.map((r) => r.driverId)).size, 3, "a driver got two trips");
  assert.equal(new Set(matched.map((r) => r.tripId)).size, 3, "duplicate trip ids");
  console.log("PASS    no double-booking: 50 requests, 3 drivers -> 3 matched, 47 queued");

  // ---- 3. Queue drains in FIFO order as drivers free up
  const firstThree = queued.slice(0, 3).map((r) => r.requestId);
  for (const m of matched) disp.completeTrip(m.tripId);
  await sleep(50);
  const nowMatched = [...disp.requests.values()].filter((r) => r.status === "matched" && !matched.some((m) => m.requestId === r.requestId));
  assert.deepEqual(nowMatched.map((r) => r.requestId).sort(), firstThree.sort());
  console.log("PASS    FIFO retry: freed drivers went to the 3 oldest queued riders");
}

// ---- 4. Idempotency: same requestId many times -> one trip
{
  const disp = makeDispatcher();
  disp.addDriver("d0", near(0));
  disp.addDriver("d1", near(1));
  const results = await Promise.all(Array.from({ length: 25 }, () => disp.requestRide("same-id", near(0))));
  assert.equal(disp.trips.size, 1, "retry created a second trip");
  assert.equal(new Set(results.map((r) => r.tripId)).size, 1);
  const later = await disp.requestRide("same-id", near(0));   // retry after the fact
  assert.equal(later.tripId, results[0].tripId);
  assert.equal(disp.trips.size, 1);
  console.log("PASS    idempotent: 25 concurrent + 1 later retry with one requestId -> 1 trip");
}

// ---- 5. Failed persist releases the driver
{
  let fail = true;
  const disp = makeDispatcher({ persistTrip: async () => { await jitter(); if (fail) throw new Error("db down"); } });
  disp.addDriver("d0", near(0));
  const r = await disp.requestRide("a", near(0));
  assert.equal(r.status, "failed");
  fail = false;
  const r2 = await disp.requestRide("b", near(0));
  assert.equal(r2.status, "matched", "driver was not released after failure");
  console.log("PASS    failed persist: driver released and reused");
}
console.log("\nAll dispatcher tests passed.");