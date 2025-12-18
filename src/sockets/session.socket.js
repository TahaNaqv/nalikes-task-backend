module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);

        socket.on("join_session", ({ sessionId }) => {
            socket.join(sessionId);
            io.to(sessionId).emit("broadcast", {
                message: "Player joined session"
            });
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected:", socket.id);
        });
    });
};
