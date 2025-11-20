// server.js
// Lohit SOAP App v1.7.2 - Final
// Features:
// - SOAP / Toolbox / Consult modes
// - Vision for SOAP + Toolbox (Hybrid mode for Toolbox)
// - JSON schema (soap + feedback)
// - QR Send-to-Desktop relay
// - Single static server (serves index.html from same folder)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const crypto = require("crypto");
const path = require("path");

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "25mb" })); // allow base64 images

// ---- System prompts ----

function getSoapSystemPrompt() {
  return `
You are the dedicated SOAP generator for a small animal veterinary clinic (dogs and cats).
Follow these MASTER RULES (summarized):

• Output a SINGLE text block, Avimark-friendly. No Markdown, no bullet symbols, no emojis, no extra blank lines.
• Use standard SOAP structure in order: Subjective, Objective, Assessment, Plan.
• For surgical/dental cases, Plan must always be in this order, with labels:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare

• Objective:
  - Full PE by body system (General, Vitals, Eyes, Ears, Oral, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic).
  - Bloodwork and diagnostics are data-only (numbers/findings only, no interpretation).
  - Interpretation always goes in Assessment.

• Assessment:
  - Clear problem list with brief interpretation.
  - Include ASA status for any anesthetic/surgical case if provided or implied.

• Plan:
  - Every drug name must include the concentration in brackets immediately after (e.g., Dexmedetomidine [0.5 mg/ml], Midazolam [5 mg/ml], Hydromorphone [2 mg/ml]).
  - Do NOT list administration times.
  - For dog neuters: Monocryl 2-0 standard; 0 Monocryl for dogs >35 kg, unless user overrides.
  - For dentals with extractions: mention a size 10 blade and periosteal elevator; note that extractions follow AAHA/AVDC standards and/or clinic written protocol.
  - For oral flap closures: "tension-free flap, no denuded bone, suture line not over defect" with 4-0 Monocryl in a simple interrupted pattern when appropriate.

• Dental anesthesia:
  - Assume monitoring includes SPO2, ETCO2, blood pressure, ECG, and fluids.
  - Local oral nerve blocks (infraorbital, maxillary, mental, inferior alveolar) should use lidocaine up to 2 mg/kg in cats and 4 mg/kg in dogs when blocks are used.

• Privacy:
  - Never invent or echo real owner names, phone numbers, emails, addresses, microchip numbers, or exact ID numbers. If present in intake, replace with generic terms like "the owner" or "the patient".
  - When a microchip is implanted, just say "Microchip implanted today." and never include the number.

• Two modes:
  - Strict: never invent missing data; clearly mark blanks as "____" or "Information not provided."
  - Help Me: you may safely template NORMAL findings or standard wording, but at the end you must provide a short "Missing / Assumed" summary describing what was assumed.

Your response must be pure text (no JSON, no Markdown headings), because it will be pasted directly into Avimark.
  `.trim();
}

function getToolboxSystemPrompt(toolboxImageMode) {
  const modeText =
    toolboxImageMode === "auto"
      ? "AUTO-DETECT what the images contain based on their content."
      : `INTERPRET the images as: ${toolboxImageMode}. Do NOT guess a different category.`;

  return `
You are a veterinary Toolbox helper for a small animal clinic (dogs and cats).

Tasks you may be asked to do:
• Summarize or interpret bloodwork (CBC/chem) that the user pastes or shows in images.
• Interpret cytology (e.g., ears, skin) from text or photos of lab sheets.
• Summarize radiology reports from screenshots.
• Extract medications, doses, and frequencies from Avimark screenshots or treatment sheets.
• Summarize whiteboard/handwritten notes into clear action items.
• Draft short emails or client handouts.
• Draft quick client communication notes for Avimark.
• Help with small "helper" texts (not necessarily full SOAP).

Vision behaviour (Hybrid mode):
${modeText}

If you see:
• Bloodwork image: identify key abnormalities concisely.
• Cytology report/image: summarize cell types, bacteria/yeast, inflammation levels in simple language.
• Radiology report: extract the Impression/Conclusion and summarize.
• Avimark screenshot / treatment sheet: extract meds (drug name, concentration when visible, dose, route, frequency, duration).
• Freeform notes/whiteboard: summarize main clinical points and tasks.

Output:
• Avimark-friendly text (no Markdown bullets, no emojis).
• If interpreting bloodwork or similar, it's often helpful to include:
  - One "Objective abnormalities" sentence.
  - One "Assessment / Interpretation" sentence.
• If drafting an email or handout, write it in a warm, clear, client-facing tone.
• Respect privacy: do not output real owner names, phone numbers, emails, addresses, microchip numbers, or exact IDs.

You will return your main text in the "soap" field of the JSON schema (even though it is Toolbox output, not a SOAP), and a short "feedback" paragraph describing what you used and what might be missing.
  `.trim();
}

function getConsultSystemPrompt() {
  return `
You are a veterinary consult assistant for a small animal GP clinic.
The doctor may paste free-form notes, speak to you (transcribed), or upload photos.

Your job:
• Provide clinical reasoning, differential diagnoses, and plan suggestions.
• Stay within small animal GP scope; do NOT give advice conflicting with local laws or standards of care.
• Your tone should be collegial, as if speaking to another veterinarian.

Output:
• Free-text, Avimark-pasting friendly (no markdown bullets, no emojis).
• You can use mini headings like "Assessment:" and "Plan:" inline when helpful.
• Do not include owner names, phone numbers, addresses, microchip numbers, or IDs.

You will return your main text in the "soap" field of the JSON schema, and a short "feedback" paragraph describing what information you would still like to see.
  `.trim();
}

// ---- QR Relay (Send to Desktop) ----

const sharedMemory = new Map(); // id -> text

app.post("/api/share", (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: "No text provided" });
    }

    const id = crypto.randomBytes(3).toString("hex"); // 6-char code
    sharedMemory.set(id, text);

    // auto-expire after 10 minutes
    setTimeout(() => sharedMemory.delete(id), 10 * 60 * 1000);

    res.json({
      success: true,
      id,
      url: `/api/shared/${id}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/shared/:id", (req, res) => {
  const { id } = req.params;
  if (!sharedMemory.has(id)) {
    return res.status(404).json({ success: false, error: "Not found or expired" });
  }
  res.json({ success: true, text: sharedMemory.get(id) });
});

// ---- Main generate endpoint ----

app.post("/api/generate", async (req, res) => {
  try {
    const {
      appMode,          // "soap" | "toolbox" | "consult"
      caseType,         // "appointment" | "surgery"
      surgeryMode,      // "simple" | "advanced"
      strictMode,       // boolean
      formData,         // object
      freeText,         // string
      extraText,        // string
      images,           // [dataUrl, ...]
      toolboxImageMode, // "auto" or specific type
    } = req.body;

    const mode = appMode || "soap";
    const toolboxMode = toolboxImageMode || "auto";

    let systemPrompt;
    if (mode === "toolbox") {
      systemPrompt = getToolboxSystemPrompt(toolboxMode);
    } else if (mode === "consult") {
      systemPrompt = getConsultSystemPrompt();
    } else {
      systemPrompt = getSoapSystemPrompt();
    }

    const strictFlag = !!strictMode;

    // Flatten formData into readable text
    const formSummaryLines = [];

    if (mode === "soap") {
      formSummaryLines.push(
        `SOAP MODE: ${caseType === "surgery" ? "Surgery/Anesthesia" : "Appointment"} case.`
      );
      formSummaryLines.push(`Surgery layout mode: ${surgeryMode || "simple"}.`);
    } else if (mode === "toolbox") {
      formSummaryLines.push("Mode: Toolbox (helper text generator).");
      formSummaryLines.push(`Toolbox image mode: ${toolboxMode}.`);
    } else {
      formSummaryLines.push("Mode: Consult (vet-to-vet reasoning).");
    }

    if (formData && typeof formData === "object") {
      for (const [key, value] of Object.entries(formData)) {
        if (value === null || value === undefined || value === "") continue;
        formSummaryLines.push(`${key}: ${value}`);
      }
    }

    const formSummary = formSummaryLines.join("\n");

    const strictInstruction = strictFlag
      ? "STRICT MODE: Do NOT invent missing details. Leave anything not provided as a clear blank or 'Information not provided'."
      : "HELP ME MODE: You may template NORMAL findings or standard wording, but you must add a short 'Missing / Assumed' summary at the end.";

    const freeTextBlock =
      freeText && freeText.trim().length
        ? `DOCTOR FREE TEXT / NOTES:\n${freeText.trim()}`
        : "DOCTOR FREE TEXT / NOTES: (none provided)";

    const extraTextBlock =
      extraText && extraText.trim().length
        ? `EXTRA INSTRUCTIONS / NUANCE FROM DOCTOR:\n${extraText.trim()}`
        : "EXTRA INSTRUCTIONS / NUANCE FROM DOCTOR: (none provided)";

    const taskLine =
      mode === "soap"
        ? "TASK: Generate a single, Avimark-friendly SOAP note following the Master Rules above."
        : mode === "toolbox"
        ? "TASK: Act as the Toolbox helper and produce the requested helper text based on the notes and images."
        : "TASK: Act as the consult assistant and provide assessment/plan style reasoning for the case.";

    // Build user content (text + optional images)
    const userContent = [
      {
        type: "text",
        text: [
          strictInstruction,
          "",
          "STRUCTURED FORM SUMMARY:",
          formSummary || "(no structured form data provided)",
          "",
          freeTextBlock,
          "",
          extraTextBlock,
          "",
          taskLine,
          "",
          "IMPORTANT: Your OUTPUT format is controlled by the JSON schema (soap + feedback).",
          "The 'soap' field must contain the main text (SOAP, toolbox output, or consult note).",
          "The 'feedback' field must contain a short paragraph describing missing data, assumptions, and next useful inputs.",
        ].join("\n"),
      },
    ];

    if (Array.isArray(images)) {
      for (const dataUrl of images) {
        if (!dataUrl || typeof dataUrl !== "string") continue;
        userContent.push({
          type: "input_image",
          image_url: { url: dataUrl },
        });
      }
    }

    const response = await openai.responses.create({
      model: "gpt-5.1", // vision + reasoning
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "soap_response",
          schema: {
            type: "object",
            properties: {
              soap: {
                type: "string",
                description:
                  "The full main output text (SOAP, toolbox result, or consult note) in plain text, ready to paste into Avimark.",
              },
              feedback: {
                type: "string",
                description:
                  "A short feedback paragraph describing missing data, assumptions made, and suggested next inputs.",
              },
            },
            required: ["soap", "feedback"],
          },
          strict: true,
        },
      },
      max_output_tokens: 2000,
    });

    let soapText = "";
    let feedbackText = "";

    try {
      const firstOutput = response.output[0];
      if (firstOutput && Array.isArray(firstOutput.content)) {
        const block = firstOutput.content[0];
        if (block && block.type === "output_json" && block.json) {
          soapText = block.json.soap || "";
          feedbackText = block.json.feedback || "";
        }
      }
    } catch (parseErr) {
      console.error("Error parsing JSON response:", parseErr);
    }

    if (!soapText) {
      soapText = "Error: No main text returned from model.";
    }
    if (!feedbackText) {
      feedbackText = "Feedback not available for this run.";
    }

    res.json({
      success: true,
      soap: soapText,
      feedback: feedbackText,
    });
  } catch (err) {
    console.error("Error in /api/generate:", err.response?.data || err.message || err);
    res.status(500).json({
      success: false,
      error: "Server error while generating output.",
      detail: err.message || String(err),
    });
  }
});

// ---- Static file serving ----
// Serve index.html and assets from the same folder.
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.7.2 server running at http://localhost:${PORT}`);
});