const URL = "ws://localhost:8080";
const driver = new WebSocket(URL);
const rider = new WebSocket(URL);

driver.onmessage = (e) => console.log("DRIVER got:", e.data);
rider.onmessage = (e) => console.log("RIDER  got:", e.data);

driver.onopen = () => {
  driver.send(JSON.stringify({ type: "hello", role: "driver", id: "d1" }));
  driver.send(JSON.stringify({ type: "driver.location", latitude: 37.7749, longitude: -122.4194 }));
};

rider.onopen = () => {
  rider.send(JSON.stringify({ type: "hello", role: "rider", id: "r1" }));
  setTimeout(() => {
    rider.send(JSON.stringify({
      type: "ride.request", requestId: "req1", latitude: 37.775, longitude: -122.418,
    }));
  }, 300);
};

setTimeout(() => process.exit(0), 1500);