export function haversineDistance(a, b) {
  const earthRadiusKM = 6371;
  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const distanceLatitude = toRadians(b.latitude - a.latitude);
  const distanceLongitude = toRadians(b.longitude - a.longitude);
  const radiansLatitude1 = toRadians(a.latitude);
  const radiansLatitude2 = toRadians(b.latitude);

  const x =
    Math.sin(distanceLatitude / 2) ** 2 +
    Math.cos(radiansLatitude1) *
    Math.cos(radiansLatitude2) *
    Math.sin(distanceLongitude / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return earthRadiusKM * c;
}
