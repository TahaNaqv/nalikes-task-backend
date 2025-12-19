const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user.routes");
const sessionRoutes = require("./routes/session.routes");
const errorHandler = require("./middlewares/errorHandler.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
      code: 'NOT_FOUND'
    }
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

module.exports = app;
