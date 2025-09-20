import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// Middleware
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
// CORS Setup
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "HEAD", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
import authRouter from "./routes/auth.routes.js";
app.use("/api/v1/auth", authRouter);

// Default Route
app.get("/", (req, res) => {
  res.send("Welcome to my Page!");
});

export default app;
