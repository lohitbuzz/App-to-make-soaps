// backend/server.js

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

// Load environment variables (OPENAI_API_KEY from Render / local .env)
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Simple sanity log for the API key (doesn't print the key itself)
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is missing. Set it in Render or .env.");
} else {
  console.log("✅ OPENAI_API_KEY loaded.");
}

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- SYSTEM BRAIN PROMPT ----------------

const SYSTEM_PROMPT = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli.

Your job is to turn raw intake JSON from the app into either:
1) A high-quality SOAP note, or
2) A toolbox output snippet (bloodwork summary, email text, client note, etc.),
depending on what the JSON says.

Global rules:
- Follow the clinic's Master Rules, SOAP templates, dental/surgery rules, and Avimark spacing as much as possible.
- Never invent client or pet names or microchip numbers.
- When generating SOAPs:
  - Use Subjective, Objective, Assessment, Plan.
  - Keep formatting Avimark-friendly plain text (no markdown, no bullet symbols).
  - Put bloodwork values/data in Objective; interpretation in Assessment.
  - For surgery/dental cases, include ASA in Assessment when appropriate.
- When generating toolbox content:
  - Output only the requested text (e.g. bloodwork summary, client email), not a full SOAP.
  - Be concise and clinically appropriate for small animal practice.

If the JSON indicates "strict" mode, do NOT invent missing data; leave explicit gaps.
If it indicates "help" or "help me" mode, you may fill in gentle templated normals, but clearly separate assumed material if the JSON asks for it.

Always respond with plain text only – no JSON, no markdown.
`;

// Helper: stringify intake safely for the model
function buildIntakeText(body) {
  try {
    return JSON.stringify(body, null, 2);
  } catch (e) {
    return String(body);
  }
}

// ---------------- Health check ----------------

app.get("/", (req, res) => {
  res.send("Lohit SOAP backend is alive.");
});

// ---------------- Main SOAP / Toolbox endpoint ----------------
// NOTE: Frontend points to /api/soap for BOTH SOAP + toolbox.
// ... your /api/soap route is here ...

// === Simple in-memory text transfer relay for "send to desktop" ===
const xferChannels = new Map(); // channelId -> { text: string | null, createdAt: number }

function makeChannelId() {
  return Math.random().toString(36).slice(2, 10) +
         Math.random().toString(36).slice(2, 10);
}

app.post("/api/xfer/start", (req, res) => {
  const channelId = makeChannelId();
  xferChannels.set(channelId, { text: null, createdAt: Date.now() });
  const now = Date.now();
  for (const [id, info] of xferChannels.entries()) {
    if (now - info.createdAt > 10 * 60 * 1000) {
      xferChannels.delete(id);
    }
  }
  res.json({ channelId });
});

app.post("/api/xfer/send", (req, res) => {
  const { channelId, text, type } = req.body || {};
  if (!channelId || typeof text !== "string") {
    return res.status(400).json({ error: "channelId and text are required" });
  }
  const channel = xferChannels.get(channelId);
  if (!channel) {
    return res.status(404).json({ error: "Channel not found or expired" });
  }
  channel.text = text;
  channel.type = type || "snippet";
  channel.receivedAt = Date.now();
  return res.json({ ok: true });
});

app.get("/api/xfer/receive", (req, res) => {
  const channelId = req.query.channelId;
  if (!channelId) {
    return res.status(400).json({ error: "channelId is required" });
  }
  const channel = xferChannels.get(channelId);
  if (!channel) {
    return res.status(404).json({ error: "Channel not found or expired" });
  }
  if (typeof channel.text !== "string") {
    return res.json({ ready: false });
  }
  const payload = {
    ready: true,
    text: channel.text,
    type: channel.type || "snippet",
  };
  xferChannels.delete(channelId);
  return res.json(payload);
});
app.post("/api/soap", async (req, res) => {
  const modeLabel = req.body?.mode || req.body?.accuracyMode || "unknown";
  const sourceLabel = req.body?.source || req.body?.tab || "unknown";

  console.log(
    `🧠 /api/soap called. Mode: ${modeLabel}, Source: ${sourceLabel}`
  );

  const intakeText = buildIntakeText(req.body);

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content:
            "Here is the raw intake JSON from the Lohit SOAP app:\n\n" +
            intakeText +
            "\n\n" +
            "Decide whether this is a SOAP note request or a toolbox request " +
            "(e.g. bloodwork helper, email helper, etc.) based on the fields. " +
            "Then generate the appropriate single plain-text output. " +
            "Do not include any explanations or commentary.",
        },
      ],
    });

    const text =
      completion?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.error("❌ OpenAI completion had no text.");
      return res
        .status(500)
        .json({ ok: false, error: "No text from model", text: "" });
    }

    // 🔴 This is the crucial part the frontend expects:
    // it needs a JSON with a "text" field.
    res.json({ ok: true, text });
  } catch (err) {
    console.error("❌ Error in /api/soap:", err);

    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Unknown error from OpenAI";

    res
      .status(500)
      .json({ ok: false, error: message, text: "" });
  }
});

// ---------------- (Optional) simple toolbox alias ----------------
// If later your frontend calls /api/toolbox directly, this will still work.

app.post("/api/toolbox", async (req, res) => {
  // Just forward to the same logic as /api/soap
  console.log("🔁 /api/toolbox alias hit, forwarding to /api/soap handler.");
  // Reuse handler by making an internal fetch-like call
  // but simpler: just call the same core logic again.
  // To avoid code duplication, we could refactor, but for now we forward JSON.

  // Attach a hint so the brain knows it's toolbox
  const bodyWithHint = {
    ...req.body,
    source: req.body.source || "toolbox",
  };

  req.body = bodyWithHint;
  // Call the main handler function manually
  // (we can't literally "call" app.post, so we duplicate logic slightly)
  const intakeText = buildIntakeText(req.body);

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content:
            "This is a TOOLBOX request from the Lohit SOAP app.\n\nRaw intake JSON:\n\n" +
            intakeText +
            "\n\nGenerate ONLY the toolbox text requested (e.g., bloodwork summary, email body, note).",
        },
      ],
    });

    const text =
      completion?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.error("❌ OpenAI completion had no text (toolbox).");
      return res
        .status(500)
        .json({ ok: false, error: "No text from model", text: "" });
    }

    res.json({ ok: true, text });
  } catch (err) {
    console.error("❌ Error in /api/toolbox:", err);

    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Unknown error from OpenAI";

    res
      .status(500)
      .json({ ok: false, error: message, text: "" });
  }
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(
    `🚀 Lohit SOAP backend listening on port ${port}`
  );
});