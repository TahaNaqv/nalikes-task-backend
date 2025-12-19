require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const initSocket = require("./sockets/session.socket");
const SessionAutoEndService = require("./services/sessionAutoEnd.service");

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Make io accessible to routes/controllers via app.locals
app.locals.io = io;

connectDB();
initSocket(io);

// Start auto-end service for sessions
const autoEndService = new SessionAutoEndService(io);
autoEndService.start();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    autoEndService.stop();
    server.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    autoEndService.stop();
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
