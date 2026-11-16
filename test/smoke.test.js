import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistance } from '../src/distanceFormula.js';
import {states, nextRideState} from '../src/tripLogic.js';

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