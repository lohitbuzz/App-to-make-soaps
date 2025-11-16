// server.js (v1.3)
const express = require("express");
const cors = require("cors");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- OpenAI client ----------
const apiKey = process.env.OPENAI_API_KEY;
let client = null;

if (apiKey) {
  client = new OpenAI({ apiKey });
  console.log("✅ OpenAI client initialized.");
} else {
  console.warn("⚠️ OPENAI_API_KEY not set. AI endpoints will run in STUB mode.");
}

// You can override with OPENAI_MODEL in Render if you want.
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------- HELPERS ----------

// Join SOAP sections into a single text block
function joinSoapSections(sections = {}) {
  const order = [
    "Subjective",
    "Objective",
    "Assessment",
    "Plan",
    "Medications Dispensed",
    "Aftercare"
  ];

  return order
    .map((key) => {
      const value = sections[key] || "";
      return `${key}:\n${value || ""}`.trim();
    })
    .join("\n\n");
}

// MAIN SOAP GENERATOR
async function generateSoapFromInput(intake) {
  const pretty = JSON.stringify(intake || {}, null, 2);
  const accuracyMode = intake.accuracyMode || "medium";
  const type = intake.type || "appointment";
  const template = intake.template || "general";

  let accuracyText = "";
  if (accuracyMode === "strict") {
    accuracyText =
      "- STRICT MODE: Do NOT invent any vitals, diagnostics, or drugs that are not clearly provided. If information is missing, write 'Details not provided.'\n";
  } else if (accuracyMode === "liberal") {
    accuracyText =
      "- LIBERAL MODE: You may fill in reasonable templated normals and mild assumptions, but clearly mark them as 'assumed' or 'templated' and avoid specific vitals or drugs that were not mentioned.\n";
  } else {
    accuracyText =
      "- MEDIUM MODE: Fill in reasonable, generic phrasing but do not invent specific vitals or specific drug names that were not implied.\n";
  }

  const prompt =
    "You are a veterinary assistant generating SOAP notes for a small animal clinic.\n" +
    `Case type: ${type}\nTemplate hint: ${template}\n\n` +
    "Use EXACTLY these section headers once each, in this order:\n" +
    "Subjective:\nObjective:\nAssessment:\nPlan:\nMedications Dispensed:\nAftercare:\n\n" +
    "Clinic rules:\n" +
    "- Output must be plain text, Avimark-compatible. No bullets, no numbering, no markdown.\n" +
    "- Single spacing; one blank line between sections is OK but not required.\n" +
    "- Bloodwork values appear as data-only in Objective; interpretations go in Assessment.\n" +
    accuracyText +
    "- Reasonable, concise language suitable for a busy general practice.\n\n" +
    "Intake JSON from the Lohit SOAP app:\n" +
    pretty +
    "\n\nWrite the full SOAP note now with the exact section headers as specified.";

  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
    temperature: 0.3
  });

  const soapText = (response.output_text || "").trim();
  return soapText;
}

// REFINEMENT HELPER
async function refineSoapWithFeedback(payload) {
  const { sections, feedback, sectionsToRefine, accuracyMode, meta } = payload || {};

  const currentSoap = joinSoapSections(sections || {});
  const prettyMeta = JSON.stringify(meta || {}, null, 2);
  const mode = accuracyMode || "medium";

  let accuracyText = "";
  if (mode === "strict") {
    accuracyText =
      "- STRICT MODE: Do not add any new diagnostics or drugs not already present unless clearly requested in the feedback.\n";
  } else if (mode === "liberal") {
    accuracyText =
      "- LIBERAL MODE: You may use reasonable templated phrasing and assumptions, but avoid inventing specific new drugs.\n";
  } else {
    accuracyText =
      "- MEDIUM MODE: You may clarify and clean up wording but do not add major new diagnostics or drugs.\n";
  }

  const prompt =
    "You are refining a veterinary SOAP note for a small animal clinic.\n\n" +
    "Here is the current SOAP (with section headers):\n\n" +
    currentSoap +
    "\n\nUser feedback:\n" +
    (feedback || "No feedback") +
    "\n\nThe sections the user is asking you to adjust are:\n" +
    (sectionsToRefine || []).join(", ") +
    "\n\nMeta JSON from the app:\n" +
    prettyMeta +
    "\n\nRules:\n" +
    "- Preserve the original overall structure and clinic rules.\n" +
    "- Only meaningfully change the sections listed above, unless a tiny change is required for consistency.\n" +
    "- Keep exactly these section headers and order: Subjective, Objective, Assessment, Plan, Medications Dispensed, Aftercare.\n" +
    accuracyText +
    "- Return the FULL SOAP again as plain text with those headers, in order.\n";

  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
    temperature: 0.3
  });

  const soapText = (response.output_text || "").trim();
  return soapText;
}

// TOOLBOX HELPER
async function generateToolboxFromInput(intake) {
  const { mode, detailLevel, text, clinic, fromName } = intake || {};
  const pretty = JSON.stringify(intake || {}, null, 2);

  let systemInstructions =
    "You are a veterinary assistant helping a small animal clinic. " +
    "All output must be plain text, Avimark-compatible, no bullets, no markdown.\n";

  let userPrompt = "";

  switch (mode) {
    case "bloodwork":
      systemInstructions +=
        "Task: summarize bloodwork for the medical record.\n" +
        "- Only list abnormal values with their reference ranges in brackets.\n" +
        "- Provide a one-line Objective entry: labs performed + abnormal values only.\n" +
        "- Provide a one-line Assessment summarizing key problems.\n" +
        "- Do NOT give a client explanation here.\n";
      break;
    case "bloodwork_diffs":
      systemInstructions +=
        "Task: interpret bloodwork and suggest differentials.\n" +
        "- First line: Assessment-style summary listing each problem and key value(s).\n" +
        "- Then list 3–5 likely differentials total, considering all problems together.\n";
      break;
    case "client_call":
      systemInstructions +=
        "Task: create a brief call log for the medical record.\n" +
        "- Start with 'Client called and discussed: ' then list key abnormal findings.\n" +
        "- Then add a short note about recommendations and follow-up.\n";
      break;
    case "client_email":
      systemInstructions +=
        "Task: draft an email to the pet owner explaining the case or bloodwork in plain language.\n" +
        `Clinic: ${clinic || "unspecified"}.\n` +
        `Sign as: ${fromName || "Doctor"}.\n` +
        "- Friendly but professional tone.\n" +
        "- Short intro, then explain main findings and what they mean, then next steps and a warm closing.\n";
      break;
    default:
      systemInstructions +=
        "Task: free-form helper. You may be asked to format text, summarize notes, or draft SOAP snippets.\n";
      break;
  }

  const detail =
    detailLevel === "short"
      ? "Keep it very short (1–2 lines)."
      : detailLevel === "expanded"
      ? "Provide a more detailed explanation, but still suitable to paste into Avimark."
      : "Use a standard level of detail.";

  userPrompt =
    systemInstructions +
    "\nLevel of detail: " +
    detail +
    "\n\nOriginal notes / text from the clinic app:\n" +
    (text || "") +
    "\n\nNow produce the final output text.";

  const response = await client.responses.create({
    model: MODEL,
    input: userPrompt,
    temperature: 0.3
  });

  const outText = (response.output_text || "").trim();
  return outText;
}

// ---------- ROUTES ----------

// SOAP endpoint
app.post("/api/soap", async (req, res) => {
  if (!client) {
    const body = JSON.stringify(req.body || {}, null, 2);
    const stub =
      "SOAP generation is in STUB mode (no API key configured).\n\nInput received:\n" +
      body;
    return res.json({ mode: "stub", soap: stub, soapText: stub });
  }

  try {
    const soapText = await generateSoapFromInput(req.body);
    res.json({ mode: "ai", soap: soapText, soapText });
  } catch (err) {
    console.error("❌ Error in /api/soap:", err);
    const body = JSON.stringify(req.body || {}, null, 2);
    const fallback =
      "SOAP generation temporarily unavailable due to an error.\n\n" +
      "Here is your raw input so nothing is lost:\n" +
      body;
    res.json({ mode: "error", soap: fallback, soapText: fallback });
  }
});

// SOAP refinement endpoint
app.post("/api/refine-soap", async (req, res) => {
  if (!client) {
    const body = JSON.stringify(req.body || {}, null, 2);
    const stub =
      "Refinement is in STUB mode (no API key configured).\n\nInput received:\n" +
      body;
    return res.json({ mode: "stub", soap: stub, soapText: stub });
  }

  try {
    const soapText = await refineSoapWithFeedback(req.body);
    res.json({ mode: "ai", soap: soapText, soapText });
  } catch (err) {
    console.error("❌ Error in /api/refine-soap:", err);
    const body = JSON.stringify(req.body || {}, null, 2);
    const fallback =
      "Refinement temporarily unavailable due to an error.\n\n" +
      "Here is your raw input so nothing is lost:\n" +
      body;
    res.json({ mode: "error", soap: fallback, soapText: fallback });
  }
});

// Toolbox endpoint – AI
app.post("/api/toolbox", async (req, res) => {
  if (!client) {
    const pretty = JSON.stringify(req.body || {}, null, 2);
    const txt =
      "Toolbox is in STUB mode (no API key configured).\n\nInput:\n" + pretty;
    return res.json({ mode: "stub", output: txt });
  }

  try {
    const text = await generateToolboxFromInput(req.body);
    res.json({ mode: "ai", output: text });
  } catch (err) {
    console.error("❌ Error in /api/toolbox:", err);
    const pretty = JSON.stringify(req.body || {}, null, 2);
    const txt =
      "Toolbox temporarily unavailable due to an error.\n\nRaw input:\n" +
      pretty;
    res.json({ mode: "error", output: txt });
  }
});

// Toolbox feedback – logs only for now
app.post("/api/toolbox-feedback", (req, res) => {
  console.log("🧰 Toolbox feedback:", req.body);
  res.json({ status: "ok", message: "Toolbox feedback received (stub)" });
});

// Global feedback – logs only for now
app.post("/api/feedback", (req, res) => {
  console.log("📥 Feedback received:", req.body);
  res.json({ status: "ok", message: "Feedback received (stub)" });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
