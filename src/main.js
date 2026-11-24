import { createServer } from "./server.js";

const server = createServer({ port: Number(process.env.PORT) || 8080 });
console.log(`WebSocket server listening on ws://localhost:${server.port}`);