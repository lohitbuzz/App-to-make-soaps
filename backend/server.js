// server.js – Lohit SOAP backend (Render + OpenAI)

// ----------------- Imports & env setup -----------------
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

// Load .env from Render Secret File (named ".env")
dotenv.config({ path: "/etc/secrets/.env" });

// Quick sanity log for API key
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is missing.");
} else {
  console.log("✅ OPENAI_API_KEY loaded.");
}

// ----------------- Express app -----------------
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Simple health check
app.get("/", (req, res) => {
  res.send("Lohit SOAP backend is alive.");
});

// ----------------- OpenAI client -----------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----------------- System brain prompt -----------------
const SYSTEM_PROMPT = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli.

Your job:
- Turn intake JSON from the Lohit SOAP App into a single Avimark-compatible SOAP note.
- Follow all clinic Master Rules for appointments, surgery, and dental cases (templates, ASA, Plan ordering, bloodwork handling, drug formatting, spacing).
- Respect clinic privacy rules (no client names, no pet names, no microchip numbers, no phone/email/address).

Global formatting rules:
- Output plain text only (no markdown, no bullets).
- Use headings in this order:
  Subjective:
  Objective:
  Assessment:
  Plan:
  Medications Dispensed:
  Aftercare:
- Objective: data-only; interpretations go in Assessment.
- Plan categories for surgery/anesthesia in this order, separated by blank lines:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- Include drug concentrations in brackets after each drug name (e.g., Dexmed