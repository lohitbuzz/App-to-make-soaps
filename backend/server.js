// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 10000;

// OpenAI client – fill in your key in Render env vars
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(
  cors({
    origin: [
      "https://lohitsoap.netlify.app",
      "https://lohit-soap-app.onrender.com"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(bodyParser.json({ limit: "2mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "Moksha SOAP backend" });
});

// MAIN SOAP / TOOLBOX / CONSULT ENDPOINT
app.post("/api/soap", async (req, res) => {
  try {
    const payload = req.body || {};

    // TODO: replace this placeholder with your full SOAP-generation logic.
    // For now, we just echo the payload so you can confirm wiring works.
    const summary = JSON.stringify(payload, null, 2);

    const text =
      "Moksha SOAP backend is wired.\n\n" +
      "You sent this payload:\n\n" +
      summary +
      "\n\n(Replace this placeholder with full SOAP logic when ready.)";

    res.json({ ok: true, text });
  } catch (err) {
    console.error("Error in /api/soap:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Moksha SOAP backend listening on port ${port}`);
});