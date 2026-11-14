export function haversineDistance(latitude_1, longitude_1,latitude_2, longitude_2){
    const earthRadiusKM = 6371;
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    const distanceLatitude = toRadians(latitude_2-latitude_1);
    const distanceLongitude = toRadians(longitude_2-longitude_1);
    const radiansLatitude1 = toRadians(latitude_1);
    const radiansLatitude2 = toRadians(latitude_2);

    const a =
        Math.sin(distanceLatitude / 2) ** 2 +
        Math.cos(radiansLatitude1) *
        Math.cos(radiansLatitude2) *
        Math.sin(distanceLongitude / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKM * c;
}

