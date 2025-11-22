import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// In-memory relay store { relayId: payload }
const relayStore = new Map();

// Optional OpenAI client
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("OpenAI client initialised.");
} else {
  console.log("OPENAI_API_KEY not set – backend will return stub text only.");
}

// Simple health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Moksha SOAP backend", time: new Date().toISOString() });
});

// ---- SOAP ENDPOINT ----
app.post("/api/soap", async (req, res) => {
  const body = req.body || {};
  const visitType = body.visitType || "appointment";
  const surgeryMode = body.surgeryMode || "simple";

  try {
    let text;

    if (!openai) {
      // Stub: structured but simple text so the app is usable without a key
      text = buildStubSoap(body, visitType, surgeryMode);
    } else {
      const systemPrompt = buildSoapSystemPrompt();
      const userPrompt = JSON.stringify(
        {
          visitType,
          surgeryMode,
          fields: body,
        },
        null,
        2
      );

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      text = completion.choices?.[0]?.message?.content?.trim();
      if (!text) {
        text = buildStubSoap(body, visitType, surgeryMode);
      }
    }

    res.json({ text });
  } catch (err) {
    console.error("SOAP /api/soap error:", err);
    res.status(500).json({ error: "Failed to generate SOAP" });
  }
});

// ---- TOOLBOX ENDPOINT ----
app.post("/api/toolbox", async (req, res) => {
  const text = (req.body && req.body.text) || "";

  try {
    let output;

    if (!openai) {
      output = `Toolbox (stub mode)\n\nOriginal:\n${text}`;
    } else {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Toolbox Lite inside a veterinary SOAP helper. Summarize bloodwork, draft short client emails, or tidy short documents. Be concise and clinic-friendly.",
          },
          { role: "user", content: text },
        ],
      });

      output = completion.choices?.[0]?.message?.content?.trim();
      if (!output) output = `Toolbox result:\n${text}`;
    }

    res.json({ text: output });
  } catch (err) {
    console.error("/api/toolbox error:", err);
    res.status(500).json({ error: "Failed to run Toolbox" });
  }
});

// ---- CONSULT ENDPOINT ----
app.post("/api/consult", async (req, res) => {
  const text = (req.body && req.body.text) || "";

  try {
    let output;

    if (!openai) {
      output = `Consult (stub mode)\n\nQuestion:\n${text}`;
    } else {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Moksha SOAP – a small animal veterinary assistant helping with emails, handouts, and general consult questions. Keep outputs clear and Avimark-friendly.",
          },
          { role: "user", content: text },
        ],
      });

      output = completion.choices?.[0]?.message?.content?.trim();
      if (!output) output = `Consult result:\n${text}`;
    }

    res.json({ text: output });
  } catch (err) {
    console.error("/api/consult error:", err);
    res.status(500).json({ error: "Failed to run Consult" });
  }
});

// ---- RELAY ENDPOINTS ----
// Send text from phone
app.post("/api/relay/send", (req, res) => {
  const { relayId, payload } = req.body || {};
  if (!relayId || !payload) {
    return res.status(400).json({ error: "relayId and payload are required" });
  }

  relayStore.set(relayId, {
    payload,
    time: Date.now(),
  });

  // Simple auto-expiry in memory
  pruneRelayStore();

  res.json({ ok: true, relayId });
});

// Receive text on desktop
app.post("/api/relay/receive", (req, res) => {
  const { relayId } = req.body || {};
  if (!relayId) {
    return res.status(400).json({ error: "relayId is required" });
  }

  const entry = relayStore.get(relayId);
  if (!entry) {
    return res.json({ ok: true, payload: null });
  }

  // Optionally delete on read
  relayStore.delete(relayId);
  res.json({ ok: true, payload: entry.payload });
});

// ---- UTILITIES ----
function pruneRelayStore() {
  const now = Date.now();
  const ttlMs = 15 * 60 * 1000; // 15 minutes
  for (const [key, value] of relayStore.entries()) {
    if (now - value.time > ttlMs) {
      relayStore.delete(key);
    }
  }
}

function buildStubSoap(body, visitType, surgeryMode) {
  const lines = [];

  const visitLabel =
    visitType === "surgery" ? "SURGERY" : "APPOINTMENT";
  const modeLabel =
    visitType === "surgery" ? `(${surgeryMode} mode)` : "(simple)";

  lines.push(`Moksha SOAP – ${visitLabel} ${modeLabel}`);
  lines.push("");

  lines.push("Subjective:");
  lines.push(body.coreHistory || "[History not provided]");
  lines.push("");

  lines.push("Objective:");
  lines.push(body.peDiagnostics || "[PE/diagnostics data not provided]");
  lines.push("");

  lines.push("Assessment:");
  lines.push(body.assessmentHints || "[Assessment hints not provided]");
  lines.push("");

  lines.push("Plan:");
  lines.push(body.planHints || "[Plan not provided]");
  lines.push("");

  lines.push("Medications dispensed:");
  lines.push("[Populate from plan / meds defaults in a future version]");
  lines.push("");

  lines.push("Aftercare:");
  lines.push(
    "- Discussed diagnosis and plan with owner.\n" +
      "- Provided written discharge instructions and clinic contact info.\n" +
      "- Advised recheck or sooner if concerns arise."
  );

  return lines.join("\n");
}

function buildSoapSystemPrompt() {
  return `
You are Moksha SOAP, a veterinary SOAP generator for a small animal practice.
You receive a JSON object with visitType, surgeryMode, and many fields typed
by the doctor. You must:

- Produce an Avimark-compatible SOAP note.
- Sections: Subjective, Objective, Assessment, Plan, Medications dispensed, Aftercare.
- Subjective: owner concerns and brief history.
- Objective: PE systems list + diagnostics with values ONLY (no interpretation).
- Assessment: problem list, differentials, and interpretation of data. Include ASA for anesthesia cases.
- Plan: diagnostics, procedures, treatments, peri-op plan, and clear structure.
- Medications dispensed: list drug name, dose, route, frequency, duration.
- Aftercare: concise client instructions, recheck timing, red flags.

Rules:
- Respect the user's text exactly where provided; don't overwrite their wording.
- If a field is missing, use safe, generic wording and clearly mark assumptions.
- Never fabricate patient identifiers or microchip numbers.
- Keep spacing Avimark-friendly: no blank lines inside sections, only one blank line between sections.
- For surgery cases, organise Plan as:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare

Output ONLY the SOAP text, no JSON and no commentary.`;
}

// ---- START ----
app.listen(port, () => {
  console.log(`Moksha SOAP backend listening on port ${port}`);
});