const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  walletAddress: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
