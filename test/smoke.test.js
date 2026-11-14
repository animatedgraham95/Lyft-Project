import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistance } from '../src/distanceFormula.js';

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
  assert.equal(haversineDistance(37.7749, -122.4194, 37.7749, -122.4194), 0);
});
test('San Francisco to Los Angeles is about 559 km', () => {
  const km = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
  assertClose(km, 559.1, 0.5);
});

test('is symmetric', () => {
  const ab = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
  const ba = haversineDistance(34.0522, -118.2437, 37.7749, -122.4194);
  assertClose(ab, ba, 1e-9);
});

test('one degree of latitude is about 111.19 km', () => {
  assertClose(haversineDistance(0, 0, 1, 0), 111.19, 0.01);
});

test('works across the international date line', () => {
  assertClose(haversineDistance(0, 179, 0, -179), 222.39, 0.01);
});