import express from "express";
import cors from "cors";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "HEAD", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

import authRouter from "./routes/auth.routes.js"

app.use("/api/v1/auth", authRouter);

app.get("/", (req, res) => {
  res.send("Welcome to my Page!");
});

export default app;