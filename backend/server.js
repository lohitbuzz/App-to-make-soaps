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
- Include drug concentrations in brackets after each drug name (e.g., Dexmedetomidine [0.5 mg/ml]).
- Midazolam concentration is always [5 mg/ml].
- Never invent vitals or TPR in strict mode.

Privacy:
- Never create or guess any client or pet names.
- Never include microchip numbers or lab order IDs.
`;

// Helper – stringify intake nicely
function buildIntakeText(body) {
  return JSON.stringify(body, null, 2);
}

// ----------------- SOAP endpoint -----------------
app.post("/api/soap", async (req, res) => {
  try {
    const strictOrHelp = req.body.strictOrHelp || "help_me"; // "strict" or "help_me"
    const mode = req.body.mode || "unknown";                 // appointment / surgery / toolbox / consult
    const intakeText = buildIntakeText(req.body);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: strictOrHelp === "strict" ? 0.1 : 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "New intake from Lohit SOAP App.\n" +
            "Case mode: " + mode + ".\n" +
            "Strictness: " + strictOrHelp + ".\n\n" +
            "Use all clinic rules to generate ONE complete Avimark-compatible SOAP for this case.\n" +
            "If some fields are missing in strict mode, leave them clearly blank instead of inventing data.\n" +
            "If in help_me mode, you may use safe templated normals but briefly flag any assumed sections.\n\n" +
            "INTAKE JSON:\n" +
            intakeText,
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Unable to generate SOAP.";

    res.json({ result: text });
  } catch (err) {
    console.error("SOAP API error:", err.response?.data || err.message || err);
    res.status(500).json({
      result: "",
      error: "Backend error calling OpenAI.",
    });
  }
});

// ----------------- Feedback endpoint (for feedback page) -----------------
app.post("/api/feedback", async (req, res) => {
  try {
    const intakeText = JSON.stringify(req.body, null, 2);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You summarize app feedback for the Lohit SOAP App. Be concise, actionable, and avoid any client/pet identifiers.",
        },
        {
          role: "user",
          content:
            "Summarize this feedback from Dr. Lohit into 3–6 concise sentences plus 3 concrete action items:\n\n" +
            intakeText,
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No feedback summary.";
    res.json({ result: text });
  } catch (err) {
    console.error("Feedback API error:", err.response?.data || err.message || err);
    res.status(500).json({
      result: "",
      error: "Backend error in feedback endpoint.",
    });
  }
});

// ----------------- Start server -----------------
app.listen(port, () => {
  console.log(`🚀 Lohit SOAP backend listening on port ${port}`);
});