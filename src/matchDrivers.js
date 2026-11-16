import { haversineDistance } from "./distanceFormula.js";
const drivers = [
  { id: 1, location: { latitude: 37.9421, longitude: -122.0625 }, available: true },
  { id: 2, location: { latitude: 40.7749, longitude: -122.4194 }, available: true },
  { id: 3, location: { latitude: 37.8044, longitude: -122.2712 }, available: false },
]
const clientLocation = 
    {latitude: 37.9421, longitude: -122.0625}

function nearestDriver(clientLocation, drivers){
   let best = null;
   let bestDistance = Infinity;
   for (const driver of drivers){
    if(driver.available === false){
        continue;
    }
    const distance = haversineDistance(clientLocation, driver.location);
    console.log("Driver ID:",driver.id, "Distance from client",distance.toFixed(2));
    if(distance < bestDistance){
        bestDistance = distance;
        best = driver
    }
    } 
    return best;
}
console.log(nearestDriver(clientLocation,drivers));

