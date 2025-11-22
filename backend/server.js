// ---------------------------
// Moksha SOAP – Backend Server (Render)
// Backend-only mode for Netlify front-end
// ---------------------------

import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(fileUpload());

// ---------------------------
// Helper: OpenAI call
// ---------------------------
async function callOpenAI(payload) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = await response.json();
  return data.output_text || "";
}

// ---------------------------
// API – SOAP / Toolbox / Consult
// ---------------------------
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, mode } = req.body;

    const payload = {
      model: "gpt-4.1",
      input: prompt,
      max_output_tokens: 18000,
      temperature: mode === "strict" ? 0.1 : 0.4,
    };

    const output = await callOpenAI(payload);
    res.json({ ok: true, output });
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------
// API – Feedback Refinement
// ---------------------------
app.post("/api/refine", async (req, res) => {
  try {
    const { original, feedback } = req.body;

    const payload = {
      model: "gpt-4.1",
      input: `Refine the following output based on feedback.\n\nOriginal:\n${original}\n\nFeedback:\n${feedback}\n\nRevised:`,
      max_output_tokens: 4000,
      temperature: 0.2,
    };

    const output = await callOpenAI(payload);
    res.json({ ok: true, output });
  } catch (err) {
    console.error("Refine error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------
// API – Relay (Phone → Desktop)
// ---------------------------
let relayStore = {};

app.post("/api/relay/send", (req, res) => {
  const { relayId, text } = req.body;
  if (!relayId) return res.json({ ok: false, error: "No relay ID" });

  relayStore[relayId] = { text, timestamp: Date.now() };
  res.json({ ok: true });
});

app.get("/api/relay/receive", (req, res) => {
  const relayId = req.query.relayId;
  if (!relayId || !relayStore[relayId]) {
    return res.json({ ok: true, text: null });
  }

  const data = relayStore[relayId];
  delete relayStore[relayId];
  res.json({ ok: true, text: data.text });
});

// ---------------------------
// API – File uploads
// ---------------------------
app.post("/api/upload", async (req, res) => {
  try {
    if (!req.files) return res.json({ ok: false, error: "No file" });

    const file = req.files.file;
    const base64 = file.data.toString("base64");

    const payload = {
      model: "gpt-4.1",
      input: "Extract relevant veterinary medical data from this image.",
      input_image: [
        {
          type: "input_image",
          image_url: `data:${file.mimetype};base64,${base64}`,
        },
      ],
      max_output_tokens: 4000,
    };

    const output = await callOpenAI(payload);
    res.json({ ok: true, output });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------
// Root Route – Diagnostic Only
// ---------------------------
app.get("/", (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; padding: 40px;">
        <h2>Moksha SOAP Backend (Render)</h2>
        <p>This is the backend-only server.  
        The full UI is served from <strong>Netlify</strong>.</p>
        <p>Status: OK</p>
      </body>
    </html>
  `);
});

// ---------------------------
// Start Server
// ---------------------------
app.listen(PORT, () => {
  console.log(`Moksha SOAP backend running on port ${PORT}`);
});