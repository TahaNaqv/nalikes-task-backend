const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const gameSessionSchema = new mongoose.Schema({
  sessionId: { type: String, default: uuidv4 },
  status: { type: String, enum: ["WAITING", "LIVE", "ENDED"], default: "WAITING" },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  startTime: Date,
  endTime: Date
}, { timestamps: true });

module.exports = mongoose.model("GameSession", gameSessionSchema);
