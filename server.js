// server.js
import express from "express";
import cors from "cors";
import path from "path";
import OpenAI from "openai";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: "5mb" }));
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

// You can override this in Render with OPENAI_MODEL if you want.
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------- HELPERS ----------

// MAIN SOAP GENERATOR
async function generateSoapFromInput(intake) {
  const pretty = JSON.stringify(intake || {}, null, 2);

  const prompt =
    "You are a veterinary assistant generating SOAP notes for a small animal clinic.\n" +
    "Use EXACTLY these section headers once each, in this order:\n" +
    "Subjective:\nObjective:\nAssessment:\nPlan:\nMedications Dispensed:\nAftercare:\n\n" +
    "Clinic rules:\n" +
    "- Output must be plain text, Avimark-compatible. No bullets, no numbering, no markdown.\n" +
    "- Single spacing; one blank line between sections is OK but not required.\n" +
    "- Bloodwork values appear as data-only in Objective; interpretations go in Assessment.\n" +
    "- Do NOT invent vitals, diagnostics, or drugs that are not supported by the input.\n" +
    "- If information is missing, write 'Details not provided.' for that portion.\n" +
    "- Reasonable, concise language suitable for a busy general practice.\n\n" +
    "Intake JSON from the Lohit SOAP app:\n" +
    pretty +
    "\n\nWrite the full SOAP note now.";

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
  const { mode, detailLevel, text } = intake || {};
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
        "- Provide a one-line Assessment summarizing key problems (e.g., 'moderate hepatocellular hepatopathy (ALT 467)').\n" +
        "- Do NOT give a client explanation here.\n";
      break;
    case "bloodwork_diffs":
      systemInstructions +=
        "Task: interpret bloodwork and suggest differentials.\n" +
        "- First line: Assessment style summary listing each problem and its key value(s).\n" +
        "- Then list 3–5 likely differentials TOTAL considering all problems together.\n" +
        "- If findings are mild or non-specific, say so.\n";
      break;
    case "client_call":
      systemInstructions +=
        "Task: create a brief call log for the medical record.\n" +
        "- Start with 'Client called and discussed: ' then list key abnormal findings in concise medical language.\n" +
        "- Then add a short note about recommendations and follow-up.\n" +
        "- This is for the RECORD, not the email to the client.\n";
      break;
    case "client_email":
      systemInstructions +=
        "Task: draft an email to the pet owner explaining the bloodwork or case in plain language.\n" +
        "- Friendly but professional tone.\n" +
        "- Start with a short summary, then explain main abnormalities and what they likely mean.\n" +
        "- Close with next steps and invitation to ask questions.\n";
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

// Toolbox endpoint – now REAL AI
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

// Feedback – keep as simple stub logger for now
app.post("/api/feedback", (req, res) => {
  console.log("📥 Feedback received:", req.body);
  res.json({ status: "ok", message: "Feedback received (stub)" });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
