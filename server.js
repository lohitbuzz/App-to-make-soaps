// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// IMPORTANT: set these in .env
// OPENAI_API_KEY=sk-.....
// OPENAI_ASSISTANT_ID=asst_......
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_ID) {
  console.warn(
    "[WARN] OPENAI_API_KEY or OPENAI_ASSISTANT_ID not set. /api/soap will fail until you configure them."
  );
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));

// Simple in-memory template store so Trainer works out of the box.
// Later you can swap this for a DB without touching the front-end.
let templates = [];

// Utility: build a single intake string from frontend payload
function buildIntake(reqBody) {
  const { mode, detail, fields } = reqBody || {};
  const {
    caseLabel,
    signalment,
    weight,
    // Appointment
    apptReasonSimple,
    apptTemplateSimple,
    apptNotesSimple,
    apptReason,
    apptTemplate,
    apptHistory,
    apptPE,
    apptDiagnostics,
    apptAssessment,
    apptPlan,
    // Surgery
    sxTypeSimple,
    sxASA,
    sxSummarySimple,
    sxType,
    sxASAadv,
    sxETT,
    sxCatheter,
    sxFluids,
    sxFluidsDeclined,
    sxPremeds,
    sxInduction,
    sxIntraOp,
    sxProcedureNotes,
    sxPostOp,
    sxTPR,
    // Consult / toolbox
    consultMode,
    consultInput,
  } = fields || {};

  const header = [
    caseLabel ? `Case label: ${caseLabel}` : null,
    signalment ? `Signalment: ${signalment}` : null,
    weight ? `Weight: ${weight} kg` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let core = "";

  if (mode === "appointment") {
    if (detail === "simple") {
      core = `
[MODE] Appointment – Simple

Reason: ${apptReasonSimple || "(not provided)"}
Template hint: ${apptTemplateSimple || "(none)"}
Quick notes: ${apptNotesSimple || "(none)"}
`;
    } else {
      core = `
[MODE] Appointment – Advanced

Reason: ${apptReason || "(not provided)"}
Template hint: ${apptTemplate || "(none)"}

History (subjective): 
${apptHistory || "(none)"}

Physical exam (Objective data-only):
${apptPE || "(none)"}

Diagnostics (Objective data-only, values only, no interpretation):
${apptDiagnostics || "(none)"}

Assessment (problem list, differentials, interpretation):
${apptAssessment || "(none)"}

Plan (treatment, diagnostics, recheck, client communication):
${apptPlan || "(none)"}
`;
    }
  } else if (mode === "surgery") {
    if (detail === "simple") {
      core = `
[MODE] Surgery – Simple

Surgery type: ${sxTypeSimple || "(not provided)"}
ASA status: ${sxASA || "(not provided)"}

Quick anesthesia/surgery summary: 
${sxSummarySimple || "(none)"}
`;
    } else {
      core = `
[MODE] Surgery – Advanced

Surgery type: ${sxType || "(not provided)"}
ASA status: ${sxASAadv || "(not provided)"}
ET tube: ${sxETT || "(not provided)"}
IV catheter: ${sxCatheter || "(not provided)"}
IV fluids: ${sxFluidsDeclined ? "DECLINED" : sxFluids || "(not provided)"}

Premedications (names, doses, routes):
${sxPremeds || "(none)"}

Induction / Maintenance:
${sxInduction || "(none)"}

Intra-op medications:
${sxIntraOp || "(none)"}

Surgical procedure notes (approach, findings, closure details):
${sxProcedureNotes || "(none)"}

Post-op meds / recovery notes:
${sxPostOp || "(none)"}

Optional TPR (objective data-only):
${sxTPR || "(none)"}
`;
    }
  } else if (mode === "consult") {
    core = `
[MODE] Consult & Toolbox

Consult type: ${consultMode || "freeform"}

User request / raw notes:
${consultInput || "(none)"}
`;
  } else {
    core = `
[MODE] Unknown – fallback

Raw body:
${JSON.stringify(reqBody, null, 2)}
`;
  }

  // This prefix helps your Assistant align with your clinic rules.
  const instructionsHint = `
[CLINIC RULES HINT]
- Output MUST be Avimark-compatible SOAP structure: Subjective, Objective, Assessment, Plan, Medications Dispensed, Aftercare (for SOAP cases).
- Objective contains only data / findings; Assessment contains interpretation and problem list.
- For anesthesia/surgery, include ASA status, anesthesia summary, and Plan subsections in this order:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- Respect privacy: do NOT include owner names, phone numbers, emails, addresses, or microchip numbers in output. If microchip implanted, only say: "Microchip implanted today."
- For dental cases, follow the clinic's AAHA/AVDC-style wording and standard flap/closure descriptions as configured in this Assistant's instructions.
`;

  return [header, instructionsHint, core].join("\n\n");
}

// --- SOAP endpoint: calls your Assistant ---
app.post("/api/soap", async (req, res) => {
  try {
    if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_ID) {
      return res.status(500).json({
        error:
          "OPENAI_API_KEY or OPENAI_ASSISTANT_ID not configured on server.",
      });
    }

    const intake = buildIntake(req.body);

    // Create a fresh thread with a single user message = intake synthesis.
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: intake,
        },
      ],
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: OPENAI_ASSISTANT_ID,
    });

    let runStatus = run.status;
    let lastRun = run;

    // Poll until the run is completed (simple non-streaming version)
    while (runStatus === "queued" || runStatus === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      lastRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      runStatus = lastRun.status;
    }

    if (runStatus !== "completed") {
      console.error("Run did not complete:", lastRun);
      return res
        .status(500)
        .json({ error: `Assistant run failed with status: ${runStatus}` });
    }

    // Get the latest assistant message
    const messages = await openai.beta.threads.messages.list(thread.id, {
      order: "desc",
      limit: 1,
    });

    const latest = messages.data[0];
    if (!latest) {
      return res
        .status(500)
        .json({ error: "No messages returned from assistant." });
    }

    const textParts = latest.content
      .filter((c) => c.type === "text")
      .map((c) => c.text.value);
    const responseText = textParts.join("\n\n").trim();

    return res.json({ soap: responseText });
  } catch (err) {
    console.error("Error in /api/soap:", err);
    return res.status(500).json({ error: "Error generating SOAP." });
  }
});

// --- Template API for Brain Trainer ---
// shape: { id, type, name, content, updatedAt }

app.get("/api/templates", (req, res) => {
  res.json({ templates });
});

app.post("/api/templates", (req, res) => {
  const { type, name, content } = req.body || {};
  if (!content) {
    return res.status(400).json({ error: "content is required" });
  }
  const tpl = {
    id: "tpl_" + Date.now(),
    type: type || "other",
    name: name || "(Untitled)",
    content,
    updatedAt: new Date().toISOString(),
  };
  templates.push(tpl);
  res.json({ template: tpl });
});

app.put("/api/templates/:id", (req, res) => {
  const id = req.params.id;
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "template not found" });
  }
  const { type, name, content } = req.body || {};
  templates[idx] = {
    ...templates[idx],
    type: type || templates[idx].type,
    name: name || templates[idx].name,
    content: content || templates[idx].content,
    updatedAt: new Date().toISOString(),
  };
  res.json({ template: templates[idx] });
});

app.delete("/api/templates/:id", (req, res) => {
  const id = req.params.id;
  templates = templates.filter((t) => t.id !== id);
  res.json({ ok: true });
});

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ ok: true, version: "1.6.7" });
});

app.listen(port, () => {
  console.log(`SOAP backend running on port ${port}`);
});