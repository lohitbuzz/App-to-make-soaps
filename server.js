// server.js - Lohit SOAP App v1.4
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || ""; // reserved for future Assistant wiring

if (!OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not set. /api/generate-soap will fail.");
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// Minimal master rules – you can expand this and paste the same text into your Assistant instructions
const MASTER_RULES = `
You are the "Lohit SOAP Assistant" helping generate Avimark-compatible SOAP notes for a small animal veterinary clinic.

GLOBAL RULES:
- Always structure output into EXACT sections with labels:
  Subjective:
  Objective:
  Assessment:
  Plan:
  Medications Dispensed:
  Aftercare:
- Do NOT invent specific vital values; only mention data explicitly given by the user or templates.
- Objective must be data-only (PE findings, diagnostics). Do not interpret labwork in Objective.
- Assessment must contain problem list and interpretations of data (including labwork).
- Plan must be organized, single-spaced. No blank lines except between logical paragraphs.
- Always use full generic drug names with concentration in brackets on first mention, e.g. "Dexmedetomidine [0.5 mg/mL] 0.003 mg/kg IM".
- Do NOT use shorthand like "dexmed", "midaz", "torb" in the SOAP text.
- For pre- and post-op analgesia, respect typical small animal doses and the clinic's patterns when the user provides summaries.

SURGERY-SPECIFIC:
- For spay/neuter and other surgeries, if "fluidsDeclined" is true, do NOT state that fluids were given.
- If "fluidsDeclined" is true and "fluidsOwnerUnderstands" is true, include a clear line in Plan noting that IV fluids were declined and that the owner understands the associated risks.
- If "fluidsUsed" is true, include a concise line in Plan describing IV fluids (e.g., "IV crystalloids at 5 mL/kg/hr intra-operatively"), but do not invent rate if not provided.
- If "bwStatus" is "declined", include that pre-anesthetic bloodwork was declined and risks were discussed.
- If "bwStatus" is "normal", you may mention that pre-anesthetic bloodwork was within normal limits.
- If "bwStatus" is "abnormal", summarize abnormalities based on "bwDetails" and interpret them in Assessment.

RESCUE LOGIC:
- Rescue surgeries (profile = "rescue") usually have:
  - Limited history (often from shelter/stray).
  - Pre-op bloodwork declined or not performed as per rescue protocol.
  - IV fluids often not used; fluidsDeclined is common.
- Use concise, repeatable wording so techs and doctors can quickly review.

CAT vs DOG:
- For cat spay/neuter, Onsior (Robenacoxib) and/or Atipamezole for reversal are common; only include them if mentioned in the intake or summaries.
- For dog spay/neuter, Meloxicam is commonly used; only include if specified.
`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

// In-memory attachments store: { [caseId]: [ { id, name, dataUrl } ] }
const attachmentsStore = Object.create(null);
// Simple feedback log in memory for now
const feedbackLog = [];

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Capture page for phone (very minimal)
app.get("/capture", (req, res) => {
  const caseId = req.query.case || "";
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Lohit SOAP Capture</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 12px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      background: #020617;
      color: #e5e7eb;
    }
    .card {
      border-radius: 16px;
      border: 1px solid #1e293b;
      background: #020617;
      padding: 16px;
      max-width: 480px;
      margin: 12px auto;
    }
    h1 {
      font-size: 1.1rem;
      margin: 0 0 4px;
    }
    p {
      font-size: 0.85rem;
      margin: 4px 0;
    }
    input[type="file"] {
      margin-top: 8px;
    }
    button {
      margin-top: 10px;
      border-radius: 999px;
      border: none;
      padding: 8px 14px;
      font-size: 0.9rem;
      background: linear-gradient(135deg,#0ea5e9,#0369a1);
      color:#f9fafb;
    }
    .status {
      margin-top: 6px;
      font-size: 0.8rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Phone capture</h1>
    <p>Case: <strong>${caseId || "unknown"}</strong></p>
    <p>Take a photo or select from your library. It will be attached to this case in the desktop app.</p>
    <input id="captureInput" type="file" accept="image/*" capture="environment" multiple />
    <button id="uploadBtn" type="button">Upload</button>
    <div id="status" class="status"></div>
  </div>
  <script>
    const caseId = ${JSON.stringify(caseId)};
    const input = document.getElementById("captureInput");
    const statusEl = document.getElementById("status");
    document.getElementById("uploadBtn").addEventListener("click", async () => {
      const files = Array.from(input.files || []);
      if (!caseId) {
        statusEl.textContent = "No case id found. Please re-open QR from desktop app.";
        return;
      }
      if (!files.length) {
        statusEl.textContent = "No photos selected.";
        return;
      }
      statusEl.textContent = "Uploading...";
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        await fetch("/api/upload-attachment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId,
            name: file.name,
            dataUrl
          })
        });
      }
      statusEl.textContent = "Uploaded. You can take more or close this page.";
      input.value = "";
    });

    function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Upload attachment (desktop or phone) - expects { caseId, name, dataUrl }
app.post("/api/upload-attachment", (req, res) => {
  const { caseId, name, dataUrl } = req.body || {};
  if (!caseId || !name || !dataUrl) {
    return res.status(400).json({ error: "Missing caseId, name or dataUrl" });
  }
  if (!attachmentsStore[caseId]) attachmentsStore[caseId] = [];
  const id = "att_" + Math.random().toString(36).substring(2, 10);
  attachmentsStore[caseId].push({ id, name, dataUrl });
  res.json({ ok: true, id });
});

// Update attachment after blur (replace dataUrl)
app.post("/api/update-attachment", (req, res) => {
  const { caseId, id, dataUrl } = req.body || {};
  if (!caseId || !id || !dataUrl) {
    return res.status(400).json({ error: "Missing caseId, id or dataUrl" });
  }
  const list = attachmentsStore[caseId];
  if (!list) return res.status(404).json({ error: "Case not found" });
  const att = list.find(a => a.id === id);
  if (!att) return res.status(404).json({ error: "Attachment not found" });
  att.dataUrl = dataUrl;
  res.json({ ok: true });
});

// List attachments for a case
app.get("/api/attachments/:caseId", (req, res) => {
  const caseId = req.params.caseId;
  res.json(attachmentsStore[caseId] || []);
});

// Feedback intake
app.post("/api/feedback", (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "No feedback text" });
  }
  feedbackLog.push({
    text,
    ts: new Date().toISOString()
  });
  console.log("FEEDBACK:", text.slice(0, 200));
  res.json({ ok: true });
});

// Generate SOAP
app.post("/api/generate-soap", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not set" });
  }

  try {
    const body = req.body || {};
    const { caseId, caseLabel, type } = body;

    // Build a structured intake summary string
    let intake = `Case label: ${caseLabel || "N/A"}\n`;
    intake += `Case id: ${caseId || "N/A"}\n`;
    intake += `Type: ${type}\n\n`;

    if (type === "appointment") {
      const a = body.appointment || {};
      intake += "APPOINTMENT INTAKE\n";
      intake += `Reason: ${a.reason || ""}\n`;
      intake += `History / Subjective: ${a.history || ""}\n`;
      intake += `Objective (PE data): ${a.objective || ""}\n`;
      intake += `Diagnostics (data-only): ${a.diagnostics || ""}\n`;
      intake += `Assessment (user notes): ${a.assessment || ""}\n`;
      intake += `Plan (user notes): ${a.plan || ""}\n`;
    } else if (type === "surgery") {
      const s = body.surgery || {};
      intake += "SURGERY INTAKE\n";
      intake += `Species: ${s.species || ""}\n`;
      intake += `Profile: ${s.profile || ""}\n`;
      intake += `Template: ${s.template || ""}\n`;
      intake += `Age: ${s.age || ""}\n`;
      intake += `Weight kg: ${s.weightKg || ""}\n\n`;

      // Bloodwork
      intake += `Bloodwork status: ${s.bwStatus || ""}\n`;
      intake += `Bloodwork details (data): ${s.bwDetails || ""}\n\n`;

      // Catheter & fluids
      intake += `IV catheter placed: ${s.ivCatheterPlaced ? "yes" : "no"} (Gauge: ${s.catheterGauge || ""}, Site: ${s.catheterSite || ""}, Side: ${s.catheterSide || ""})\n`;
      intake += `Fluids used: ${s.fluidsUsed ? "yes" : "no"}\n`;
      intake += `Fluids declined: ${s.fluidsDeclined ? "yes" : "no"}\n`;
      intake += `Owner understands fluid risks: ${s.fluidsOwnerUnderstands ? "yes" : "no"}\n`;
      intake += `Fluids rate (mL/kg/hr, if given): ${s.fluidsRate || ""}\n\n`;

      // Anesthesia summaries
      intake += `Premed summary: ${s.premedSummary || ""}\n`;
      intake += `Induction / maintenance summary: ${s.inductionSummary || ""}\n`;
      intake += `Intra-op meds / blocks summary: ${s.intraopSummary || ""}\n`;
      intake += `Post-op injectables summary: ${s.postopInjectableSummary || ""}\n`;
      intake += `Take-home meds summary: ${s.takehomeMedsSummary || ""}\n\n`;

      // Surgery notes
      intake += `Surgery subjective/history: ${s.surgerySubjective || ""}\n`;
      intake += `PE variations / abnormalities: ${s.surgeryPE || ""}\n`;
      intake += `Procedure details / intra-op findings: ${s.surgeryProcedure || ""}\n`;
      intake += `Extra aftercare notes: ${s.surgeryAftercareNotes || ""}\n`;
    }

    // We could also mention attachments (names only) to the model if you want:
    const att = attachmentsStore[caseId] || [];
    if (att.length) {
      intake += `\nATTACHMENTS PRESENT (names only): ${att.map(a => a.name).join(", ")}\n`;
    }

    const prompt = `
You will generate a single, clean SOAP note for a veterinary case based on the intake below.

Follow ALL of these instructions:

- Start each major section with the label exactly: "Subjective:", "Objective:", "Assessment:", "Plan:", "Medications Dispensed:", "Aftercare:".
- No bullets. Use short paragraphs or concise sentences.
- Objective must describe exam findings and diagnostic data only, without interpretation or speculation.
- Assessment must interpret the problems and data, including any bloodwork interpretations.
- Plan must cover IV catheter/fluids, anesthesia/analgesia, surgical procedure, recovery, and discharge instructions when applicable.
- Medications Dispensed must list only meds going home.
- Aftercare must summarize home-care instructions.
- Use full generic drug names with concentration in brackets on first mention, e.g. "Dexmedetomidine [0.5 mg/mL]".
- Do not invent specific numbers (e.g. NSAID dose, ET tube size, fluid rate) unless clearly provided in the intake summaries.
- If bloodwork was declined, record that in Assessment and Plan, and state that risks were discussed with the owner.
- If fluidsDeclined is true, do not imply fluids were given. If fluidsOwnerUnderstands is also true, explicitly state that IV fluids were declined and that the owner is aware of the associated risks.

INTAKE:
${intake}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt
    });

    const outputText = response.output_text || "";

    // naive split of sections
    const sections = {
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      meds: "",
      aftercare: ""
    };

    let currentKey = null;
    outputText.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (/^subjective:/i.test(trimmed)) {
        currentKey = "subjective";
        return;
      }
      if (/^objective:/i.test(trimmed)) {
        currentKey = "objective";
        return;
      }
      if (/^assessment:/i.test(trimmed)) {
        currentKey = "assessment";
        return;
      }
      if (/^plan:/i.test(trimmed)) {
        currentKey = "plan";
        return;
      }
      if (/^medications dispensed:/i.test(trimmed)) {
        currentKey = "meds";
        return;
      }
      if (/^aftercare:/i.test(trimmed)) {
        currentKey = "aftercare";
        return;
      }
      if (currentKey) {
        sections[currentKey] += (sections[currentKey] ? "\n" : "") + line;
      }
    });

    res.json(sections);
  } catch (err) {
    console.error("Error generating SOAP:", err);
    res.status(500).json({ error: "Failed to generate SOAP" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.4 listening on port ${PORT}`);
  if (OPENAI_ASSISTANT_ID) {
    console.log(`Assistant ID configured: ${OPENAI_ASSISTANT_ID} (not yet used directly, but keep rules in sync).`);
  }
});
