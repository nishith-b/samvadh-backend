require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth-routes");
const pollRoutes = require("./routes/poll-routes");
const path = require("path");
const helmet = require("helmet");

const app = express();

// 1. Connect to the database as early as possible
connectDB();

// 2. Security headers (Helmet) - configure CSP for images from backend
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "http://localhost:8000", "data:"], // Allow backend and data URLs
      // Add other directives as needed for scripts, styles, etc.
    },
  })
);

// 3. CORS (before routes)
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 4. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/poll", pollRoutes);

// 6. Static file serving for uploads (with CORS and CORP headers)
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

// 7. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
