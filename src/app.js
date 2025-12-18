const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user.routes");
const sessionRoutes = require("./routes/session.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);

module.exports = app;
