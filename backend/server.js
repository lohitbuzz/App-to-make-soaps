// server.js
// Simple OpenAI relay with Vision support + SOAP + Feedback JSON output

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: "25mb" })); // allow base64 images

// Small helper: build a compact but strong system prompt for SOAP mode
function getSoapSystemPrompt() {
  return `
You are the dedicated SOAP generator for a small animal veterinary clinic (dogs and cats).
Follow these MASTER RULES (summarized):

• Output a SINGLE text block, Avimark-friendly. No Markdown, no bullet symbols, no extra blank lines.
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
  - For dentals with extractions: mention periosteal elevator and a size 10 blade; note that extractions follow AAHA/AVDC standards and/or clinic written protocol.
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

Your response must be pure text (no JSON, no headings like "SOAP:"), because it will be pasted directly into Avimark.
  `.trim();
}

function getToolboxSystemPrompt() {
  return `
You are a veterinary Toolbox helper for a small animal clinic.

You can be asked to:
• Summarize or interpret bloodwork that the user pastes.
• Draft short emails or client handouts.
• Draft quick client communication notes for Avimark.
• Help with small "helper" texts (not full SOAP unless requested).

Rules:
• Output must be Avimark-friendly text (no Markdown bullets, no emojis).
• Keep things concise, practical, and in normal clinic language.
• If interpreting bloodwork, separate a one-sentence "Objective abnormalities" line from a one-sentence "Assessment / Interpretation" line when appropriate.
• Respect privacy: do not output owner names, phone numbers, emails, addresses, microchip numbers, or exact IDs.
  `.trim();
}

function getConsultSystemPrompt() {
  return `
You are a veterinary consult assistant for a small animal GP clinic.
The doctor may paste free-form notes, speak to you, or upload photos.

Your job:
• Provide clinical reasoning, differential diagnoses, and plan suggestions.
• Stay within small animal GP scope; do NOT give advice conflicting with local laws or standards of care.
• Your tone should be collegial, as if speaking to another veterinarian.

Output:
• Free-text, Avimark-pasting friendly (no markdown bullets).
• You can use mini headings like "Assessment:" and "Plan:" inline when helpful.
• Do not include owner names, phone numbers, addresses, microchip numbers, or IDs.
  `.trim();
}

app.post("/api/generate", async (req, res) => {
  try {
    const {
      appMode,      // "soap" | "toolbox" | "consult"
      caseType,     // "appointment" | "surgery" (for SOAP mode)
      surgeryMode,  // "simple" | "advanced"
      strictMode,   // boolean
      formData,     // { ... } structured fields
      freeText,     // big text box with notes
      extraText,    // extra instructions to AI
      images,       // [dataUrl, ...]
    } = req.body;

    const mode = appMode || "soap";

    // Pick the appropriate system prompt
    let systemPrompt;
    if (mode === "toolbox") {
      systemPrompt = getToolboxSystemPrompt();
    } else if (mode === "consult") {
      systemPrompt = getConsultSystemPrompt();
    } else {
      systemPrompt = getSoapSystemPrompt();
    }

    const strictFlag = !!strictMode;

    // Build a textual description of the structured formData for the model
    const formSummaryLines = [];

    if (mode === "soap") {
      formSummaryLines.push(`SOAP MODE: ${caseType === "surgery" ? "Surgery/Anesthesia" : "Appointment"} case.`);
      formSummaryLines.push(`Surgery mode: ${surgeryMode || "simple"} (this is just for context).`);
    } else {
      formSummaryLines.push(`Mode: ${mode} (Toolbox/Consult helper).`);
    }

    // Flatten formData keys in a readable way
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

    const freeTextBlock = freeText && freeText.trim().length
      ? `DOCTOR FREE TEXT / NOTES:\n${freeText.trim()}`
      : "DOCTOR FREE TEXT / NOTES: (none provided)";
    
    const extraTextBlock = extraText && extraText.trim().length
      ? `EXTRA INSTRUCTIONS / NUANCE FROM DOCTOR:\n${extraText.trim()}`
      : "EXTRA INSTRUCTIONS / NUANCE FROM DOCTOR: (none provided)";

    // Build the user content for the model (text + images)
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
          "TASK:",
          mode === "soap"
            ? "Generate a single, Avimark-friendly SOAP note following the Master Rules above."
            : mode === "toolbox"
              ? "Act as the Toolbox helper and produce the requested text."
              : "Act as the consult assistant and provide assessment/plan style reasoning.",
          "",
          "IMPORTANT: In addition to the main text, you must also internally reason about what key data is missing.",
          "Your OUTPUT format is controlled by the JSON schema in the response_format (soap + feedback).",
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

    // Call OpenAI Responses API with JSON schema (soap + feedback)
    const response = await openai.responses.create({
      model: "gpt-5.1", // has vision + good reasoning
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

    // Extract JSON from the response
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
      soapText = "Error: No SOAP text returned from model.";
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

// Serve static files if you put index.html in the same folder and run with `node server.js`
const path = require("path");
app.use(express.static(path.join(__dirname, "public"))); // optional if you put index.html in /public

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SOAP app relay server running on http://localhost:${PORT}`);
});