// -----------------------------
// Moksha SOAP – Backend v1.0
// Render-compatible (Option A)
// -----------------------------

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

// -----------------------------
// CONFIG
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// -----------------------------
// OPENAI CONFIG
// -----------------------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

// Universal request helper
async function callOpenAI(messages, model = "gpt-4.1") {
  const res = await fetch(OPENAI_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 6000,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error("OpenAI error: " + error);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// -----------------------------
//  ROUTES
// -----------------------------

// ===== HEALTH CHECK =====
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===== SOAP GENERATION =====
app.post("/api/generate", async (req, res) => {
  try {
    const payload = req.body;

    const messages = [
      {
        role: "system",
        content:
          "You are the Moksha SOAP engine. Generate full SOAPs using Lohit's global rules, spacing, formatting, and medications. NEVER invent species, weight, drugs, vaccines, or findings not provided. Use clinic rules for templates, ASA, surgical modes, and anesthesia combinations. Follow Avimark spacing.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ];

    const output = await callOpenAI(messages);

    res.json({ output });
  } catch (err) {
    console.error("SOAP ERROR:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ===== TOOLBOX =====
app.post("/api/generate-toolbox", async (req, res) => {
  try {
    const payload = req.body;

    const messages = [
      {
        role: "system",
        content:
          "You are the Moksha SOAP Toolbox engine. Produce structured outputs for bloodwork interpretation, email templates, client handouts, SOAP snippets, Covet fixer, freeform generation, and future tools. Follow clinic formatting.",
      },
      { role: "user", content: JSON.stringify(payload) },
    ];

    const output = await callOpenAI(messages);

    res.json({ output });
  } catch (err) {
    console.error("TOOLBOX ERROR:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ===== CONSULT =====
app.post("/api/generate-consult", async (req, res) => {
  try {
    const payload = req.body;

    const messages = [
      {
        role: "system",
        content:
          "You are the Moksha Consult engine. Provide differentials, next-step testing, ranking, and reasoning. Output clear, concise summaries with tiered recommendations.",
      },
      { role: "user", content: JSON.stringify(payload) },
    ];

    const output = await callOpenAI(messages);

    res.json({ output });
  } catch (err) {
    console.error("CONSULT ERROR:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ===== HELPER OUTPUT =====
app.post("/api/generate-helper", async (req, res) => {
  try {
    const payload = req.body;

    const messages = [
      {
        role: "system",
        content:
          "You are the helper console for Moksha SOAP. Take a full SOAP output and produce: discharges, emails, summaries, recheck notes, or doctor instructions.",
      },
      { role: "user", content: JSON.stringify(payload) },
    ];

    const output = await callOpenAI(messages);

    res.json({ output });
  } catch (err) {
    console.error("HELPER ERROR:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ====== QR RELAY ENDPOINT ======
let qrRelayText = "";
let qrRelayFiles = [];

app.post("/api/send-to-desktop", (req, res) => {
  qrRelayText = req.body.text || "";
  res.json({ ok: true });
});

app.get("/api/receive-text", (req, res) => {
  const text = qrRelayText;
  qrRelayText = ""; // reset after retrieval
  res.json({ text });
});

// Files relay
app.post("/api/send-files", (req, res) => {
  qrRelayFiles = req.body.files || [];
  res.json({ ok: true });
});

app.get("/api/receive-files", (req, res) => {
  const files = qrRelayFiles;
  qrRelayFiles = [];
  res.json({ files });
});

// ====== VISION (base64) ======
app.post("/api/vision", async (req, res) => {
  try {
    const { images, prompt } = req.body;

    const messages = [
      {
        role: "system",
        content:
          "You are the Vision engine for Moksha SOAP. Read screenshots of Avimark, bloodwork, documents, and extract structured data only.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...images.map((img) => ({
            type: "image_url",
            image_url: { url: img },
          })),
        ],
      },
    ];

    const output = await callOpenAI(messages, "gpt-4o-mini");

    res.json({ output });
  } catch (e) {
    console.error("VISION ERROR:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Moksha SOAP server running on port " + PORT);
});