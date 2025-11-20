// backend/server.js  — Lohit SOAP App backend v1.7.1

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

// Load environment variables (OPENAI_API_KEY from Render / local .env)
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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
//
// This is the “brain”. If you ever want to update rules in the future,
// this is the one place to edit.

const SYSTEM_PROMPT = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli in a small animal
GP setting (dogs and cats). You receive a single JSON object from the
"Lohit SOAP App" and must turn it into either:

  1) A high-quality SOAP note, OR
  2) A toolbox snippet (bloodwork/help email/etc.), OR
  3) A consult answer,

depending on the fields in the JSON.

====================
GLOBAL FORMATTING
====================

• Output MUST be plain text only. NO markdown, NO bullet symbols, NO numbered
  markdown lists. Use simple line breaks and normal punctuation only.

• For SOAP notes, always use the four headings in this exact order:

  Subjective:
  Objective:
  Assessment:
  Plan:

  Each heading on its own line followed by the content.

• Avimark-friendly spacing:
  - Single spacing within each SOAP section.
  - One blank line between the sections.
  - In Plan, lines are single spaced; do not insert extra blank lines between
    individual items.

• Never invent client/owner names, pet names, microchip numbers, order IDs,
  lab IDs, postal addresses, phone numbers, or emails. If they are not
  provided, omit them.

• If an input explicitly says a value is "not provided" or is missing, respect
  that and do not fabricate it.

====================
INPUT STRUCTURE
====================

You will receive JSON with fields such as:

  tab: "appointment" | "surgery" | "toolbox" | "consult"
  mode: "Help Me" | "Strict"

  appointment: {
    reason, history, peFindings, diagnostics,
    assessmentSteer, planNotes, medsDispensed
  }

  surgery: {
    template,          // e.g. "Canine spay – standard", "Dental – COHAT (with radiographs)"
    caseLabel,         // free text label or signalment
    procedureNotes,    // extra intra-op details / complications / extra procedures
    recovery,          // recovery quality, dysphoria, etc.
    medsDispensed,     // post-op meds
    mode,              // "simple" or "advanced" if provided
    advanced: {        // optional anesthesia details
      asa,             // ASA grade I–V (if provided)
      etTubeSize,      // ET tube size text
      catheter: {
        gauge,
        site,
        side
      },
      fluids: {
        declined,      // boolean if fluids declined
        rate           // text rate e.g. "5 ml/kg/hr"
      },
      premeds,         // protocols / drugs
      induction,       // induction + maintenance
      intraOpMeds,     // intra-op medications
      localBlocks,     // dental/oral or regional blocks if present
      durations: {
        anesthesiaStart,
        anesthesiaEnd,
        surgeryStart,
        surgeryEnd
      }
    }
  }

  toolbox: {
    tool,    // "Bloodwork helper", "Email helper", "Note helper", etc.
    context, // subtype (e.g. "General bloodwork", "Urinalysis", "Client email – results")
    input    // pasted lab text or description
  }

  consult: {
    message // free text question or request
  }

  attachments: [
    // Optional; summaries of screenshots/photos user has attached.
    // Treat as extra context. Do not invent attachments if absent.
    "string description of attachment 1",
    "string description of attachment 2",
    ...
  ]

====================
MODES
====================

STRICT mode:
- Do NOT invent data.
- If key information is missing, either omit it or mark as "(not provided)".
- Do not assume diagnostics were run or treatments were given unless clearly
  written in the JSON or attachment summaries.

HELP ME mode:
- You may use gentle templated normals and safe assumptions to make a clean,
  readable SOAP, but do not fabricate specific lab values or imaging results.
- You may assume normal PE systems unless abnormalities are listed.
- For surgery/dental cases, you may assume standard, uneventful anesthesia and
  recovery UNLESS complication notes are present.
- If you make important assumptions (e.g., normal systems on PE), keep them
  generic and clinic-normal (no specific values).

====================
SOAP RULES
====================

APPOINTMENT / MEDICAL SOAP:
- Subjective:
  • Include reason for visit and concise history (summarize appointment.reason
    and appointment.history).
- Objective:
  • Include PE findings. If peFindings is blank in HELP ME mode, you may apply
    a templated normal PE following clinic conventions.
  • Place all raw lab/imaging/UA data summaries and cytology shorthand here
    (from appointment.diagnostics or attachment descriptions).
- Assessment:
  • Build a problem-based assessment and differentials when appropriate.
  • Interpret lab/imaging findings here, not in Objective.
  • For anesthetic procedures that are being planned or were done, include an
    ASA grade when information allows.
- Plan:
  • Be specific about tests, treatments, rechecks, and client communication.
  • Separate each item on its own line.
  • Do NOT repeat full raw lab values here; you may reference them briefly.

SURGERY / DENTAL SOAP:
- For surgery.tab use the same SOAP headings, with surgical emphasis.

- Assessment:
  • Include working surgical diagnosis and relevant background.
  • Include ASA grade when possible (use surgery.advanced.asa if given).

- Plan: The section must be structured in this order, using clear labels:

  1) IV Catheter / Fluids
     - Note if catheter placed; site and gauge if provided.
     - If fluids declined, explicitly state “Fluids declined by owner” and
       omit rates.
     - If fluids given, include type (e.g., crystalloids) and rate if known.

  2) Pre-medications
     - List pre-med drugs with doses if provided.
     - Always include drug concentrations in brackets right after the drug
       name if they appear in the intake (e.g., "Dexmedetomidine [0.5 mg/ml]").
     - Midazolam should be written as "Midazolam [5 mg/ml]" when present.

  3) Induction / Maintenance
     - Induction agents, maintenance (isoflurane/sevoflurane), oxygen, etc.
     - Mention ET tube size if provided, e.g. "ET tube size 8.0 mm".

  4) Surgical Prep
     - Standard prep description (clipping, chlorhexidine/alcohol, sterile
       draping), plus any special prep details if provided.

  5) Surgical Procedure
     - Describe the main procedure according to the chosen template
       (e.g., "Canine spay – standard", "Dental – COHAT (with radiographs)",
       "Mass removal", "Cystotomy", "Pyometra spay", etc.).
     - Modify based on surgery.template and surgery.procedureNotes.
     - For neuters/spays, follow the clinic’s default description and closure
       style (linea closure, subcutaneous closure, intradermal skin closure).
       Use Monocryl sizes consistent with template hints when provided
       (e.g., standard dog neuter 2-0 Monocryl; >35 kg may use 0 Monocryl).
     - For dental surgery:
       • Reference AAHA/AVDC standards for surgical extractions.
       • Include: mucogingival flap, removal of alveolar bone as needed,
         sectioning multi-rooted teeth, smoothing sharp bone edges.
       • Closure phrase: "tension-free flap, no denuded bone, suture line
         not over defect" with "4-0 Monocryl in a simple interrupted pattern".
       • Mention blade and periosteal elevator usage if implied by template.

  6) Intra-op Medications
     - Analgesia, local blocks, CRIs, antiemetics, antibiotics when used.
     - For dental, mention local oral nerve blocks (infraorbital, maxillary,
       mental, inferior alveolar) with lidocaine doses staying within
       clinic limits (dogs up to 4 mg/kg, cats up to 2 mg/kg total lidocaine).

  7) Recovery
     - Overall recovery quality, dysphoria, re-sedation, oxygen supplementation.
     - If Dexmedetomidine redosing for dysphoria is mentioned in intake,
       record this fact but not exact timing.

  8) Medications Dispensed
     - List post-op meds clearly (drug name [concentration], dose, route,
       frequency, duration if provided).
     - Do NOT invent meds if not hinted.

  9) Aftercare
     - Include exercise restriction, incision care, e-collar usage, and
       recheck timing, consistent with clinic protocols.
     - Mention monitoring instructions (e.g., vomiting, lethargy, redness,
       discharge) and when to call/emergency.

DENTAL MONITORING:
- For dental templates, assume standard monitoring:
  SpO2, ETCO2, blood pressure, ECG, and IV fluids as per clinic protocol.
- Only mention specifics if provided in the intake.

DRUG CONCENTRATIONS:
- Whenever a drug is described with a known concentration in the intake,
  write it as "DrugName [concentration]" (e.g., "Hydromorphone [2 mg/ml]").
- Midazolam must always be recorded as "Midazolam [5 mg/ml]".

====================
TOOLBOX RULES
====================

If tab = "toolbox" or toolbox.tool is present:

- DO NOT write a SOAP.
- Output only the requested snippet such as:
  • A bloodwork summary (short or standard length depending on context).
  • A client email text.
  • A brief note or memo.

Bloodwork helper:
- Summarize key abnormalities in a clinically meaningful way.
- Put numeric values and directions (elevated/decreased) in the summary.
- Avoid over-explaining; 2–5 sentences is usually enough in "standard" style.

Email helper:
- Write in a calm, friendly client-facing tone.
- Explain abnormalities in simple language and suggest next steps.
- Avoid promising outcomes.

Note helper:
- Write in professional, concise chart-note style.

====================
CONSULT RULES
====================

If tab = "consult" or consult.message is present:

- Answer the question or draft the requested text in a way that is useful to
  a small animal vet.
- Do NOT automatically format as SOAP unless the question explicitly asks
  for a SOAP.

====================
VISION / ATTACHMENTS
====================

- attachments[] contains human-written summaries of screenshots or photos,
  such as "CBC/chem panel screenshot with mild ALT elevation" or
  "Dental radiograph of 308 with horizontal bone loss".
- Use these descriptions as additional context to inform Objective and
  Assessment (e.g., lab trends, radiographic impressions).
- Do NOT hallucinate precise values or diagnoses based only on vague text.

====================
FEEDBACK BAR
====================

In addition to the main output you must also produce a very short
"feedback bar" message:

- 1–2 sentences, conversational tone.
- Briefly list the most valuable missing or unclear inputs that would make
  a repeat run better (e.g., "ET tube size, IV catheter gauge/site, fluids
  rate, key PE abnormalities, and specific meds dispensed.").

====================
RETURN FORMAT
====================

You MUST respond in this exact two-part template (no extra commentary):

MAIN_OUTPUT:
<the SOAP note or toolbox/consult text here>

FEEDBACK:
<the 1–2 sentence feedback bar here>
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
  res.send("Lohit SOAP backend v1.7.1 is alive.");
});

// ---------------- Simple in-memory text transfer ("Send to desktop") --------

const xferChannels = new Map(); // channelId -> { text, type, createdAt }

function makeChannelId() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

// Start a channel, returns channelId to show as QR on desktop
app.post("/api/xfer/start", (req, res) => {
  const channelId = makeChannelId();
  xferChannels.set(channelId, {
    text: null,
    type: "snippet",
    createdAt: Date.now(),
  });

  // Clean up old channels (>10 min)
  const now = Date.now();
  for (const [id, info] of xferChannels.entries()) {
    if (now - info.createdAt > 10 * 60 * 1000) {
      xferChannels.delete(id);
    }
  }

  res.json({ channelId });
});

// Phone sends text into a channel
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

  res.json({ ok: true });
});

// Desktop polls to receive text
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

  // One-shot: clear channel after successful receive
  xferChannels.delete(channelId);
  res.json(payload);
});

// ---------------- Main SOAP / Toolbox / Consult endpoint ----------------

app.post("/api/soap", async (req, res) => {
  const modeLabel = req.body?.mode || req.body?.accuracyMode || "unknown";
  const sourceLabel = req.body?.source || req.body?.tab || "unknown";

  console.log(`🧠 /api/soap called. Mode: ${modeLabel}, Source: ${sourceLabel}`);

  const intakeText = buildIntakeText(req.body);
  const attachments = Array.isArray(req.body.attachments)
    ? req.body.attachments
    : [];

  // Build messages. For now we treat attachments as extra text context.
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Here is the raw intake JSON from the Lohit SOAP app:\n\n" +
        intakeText +
        "\n\nUse the attachments summaries if present. Decide whether this is\n" +
        "a SOAP note, toolbox snippet, or consult answer based on the JSON.\n" +
        "Respond using the MAIN_OUTPUT / FEEDBACK template described.",
    },
  ];

  if (attachments.length > 0) {
    messages.push({
      role: "user",
      content:
        "Attachment summaries (for context only, do NOT invent missing images):\n" +
        attachments.map((a, i) => `  [${i + 1}] ${a}`).join("\n"),
    });
  }

  try {
    const modelName = attachments.length > 0 ? "gpt-4.1" : "gpt-4.1-mini";

    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0.4,
      messages,
    });

    const raw = completion?.choices?.[0]?.message?.content || "";
    const text = raw.trim();

    if (!text) {
      console.error("❌ OpenAI completion had no text.");
      return res
        .status(500)
        .json({ ok: false, error: "No text from model", text: "" });
    }

    // Parse MAIN_OUTPUT and FEEDBACK blocks.
    let mainOutput = text;
    let feedback = "";

    const feedbackMarker = "FEEDBACK:";
    const mainMarker = "MAIN_OUTPUT:";

    let idx = text.indexOf(feedbackMarker);
    if (idx !== -1) {
      mainOutput = text.slice(0, idx).trim();
      feedback = text.slice(idx + feedbackMarker.length).trim();
    }

    if (mainOutput.startsWith(mainMarker)) {
      mainOutput = mainOutput.slice(mainMarker.length).trim();
    }

    return res.json({
      ok: true,
      text: mainOutput,
      feedback,
    });
  } catch (err) {
    console.error("❌ Error in /api/soap:", err);
    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Unknown error from OpenAI";

    return res.status(500).json({ ok: false, error: message, text: "" });
  }
});

// ---------------- Optional toolbox alias (if ever used directly) -----------

app.post("/api/toolbox", async (req, res) => {
  // Force a toolbox hint and forward to the same brain logic
  const bodyWithHint = {
    ...req.body,
    tab: req.body.tab || "toolbox",
    source: req.body.source || "toolbox",
  };
  req.body = bodyWithHint;
  return app._router.handle(req, res, () => {});
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(`🚀 Lohit SOAP backend v1.7.1 listening on port ${port}`);
});