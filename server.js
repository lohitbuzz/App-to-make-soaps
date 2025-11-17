// Lohit SOAP App v1.6 backend
// Simple Express server + /api/run endpoint for SOAP + Toolbox Lite.

const path = require("path");
const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: OPENAI_API_KEY not set. /api/run calls will fail.");
}

const openai = new OpenAI({ apiKey });

app.use(express.json());

// Serve static files from project root (index.html, app.js, style.css)
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Helper: call OpenAI with a system + user prompt
async function callOpenAI(systemPrompt, userPrompt) {
  if (!apiKey) {
    return "Error: OPENAI_API_KEY is not set on the server.";
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const choice = response.choices && response.choices[0];
  return (choice && choice.message && choice.message.content) || "";
}

// Main endpoint the frontend calls
app.post("/api/run", async (req, res) => {
  const { mode, payload } = req.body || {};

  try {
    let resultText = "";

    // 1) SOAP MODE (Appointment / Surgery)
    if (mode === "soap") {
      const systemPrompt = `
You are the backend brain for Dr. Lohit Busanelli’s Lohit SOAP App v1.6.

Always output an Avimark-compatible SOAP with this exact section order and headings:

Subjective:
Objective:
Assessment:
Plan:
Medications Dispensed:
Aftercare:

Rules (condense but follow):
- Appointment vs Surgery:
  - "soapType" in JSON will be "appointment" or "surgery".
- For EVERY SOAP:
  - Subjective: concise case summary + owner concerns.
  - Objective: full PE list by system (General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic, Diagnostics).
    - Bloodwork and other tests here as data-only, no interpretation.
    - For oral: default normal, but if age > 4 years assume mild tartar; if > 8 years moderate tartar, unless user data contradicts.
  - Assessment: problem list + interpretations of diagnostics; include ASA if surgical/anesthetic.
  - Plan: use numbered categories with blank line between categories only (Avimark compatible):

    1. IV Catheter / Fluids
    2. Pre-medications
    3. Induction / Maintenance
    4. Surgical Prep
    5. Surgical Procedure
    6. Intra-op Medications
    7. Recovery
    8. Medications Dispensed
    9. Aftercare

    (For appointment SOAPs, still keep this order but omit categories that truly do not apply.)

  - In Plan: include drug name + dose + route + concentration in [brackets] every time, e.g. "Meloxicam [5 mg/ml] 0.2 mg/kg SQ".
  - Midazolam concentration is always written as [5 mg/ml] when used.
  - Do NOT include administration times.

- Help Me vs Strict mode:
  - strictMode = true  => do NOT invent new clinical data. If information is missing, say "Not recorded" or similar.
  - strictMode = false => you may use safe templated normals (e.g. normal PE, normal recovery) BUT clearly separate truly known vs assumed. At end of Assessment add a short "Missing/Assumed:" line summarizing assumptions.

- Surgery specifics:
  - Use the template value (canine spay, neuter, dental COHAT, mass removal, etc.) as guidance for the default procedure description.
  - Always describe placement of ET tube and IV catheter in Plan, not in Objective.
  - Mention fluids and rates or "Fluids declined" if fluidsDeclined = true.
  - For standard neuters: use 2-0 Monocryl, or 0 Monocryl for >35 kg unless override checkboxes request 0, 2-0, or 3-0.
  - For dentals: mention monitoring (SpO2, ETCO2, BP, ECG, IV fluids), local nerve blocks with lidocaine (dogs up to 4 mg/kg, cats up to 2 mg/kg), and AAHA/AVDC standards for extractions if extractions implied.

- Formatting:
  - Single spacing inside each section.
  - No bullet symbols; just clear sentences / short paragraphs.
  - No extra blank lines except ONE blank line between the Plan categories (1–9) and between SOAP sections as already defined above.
  - Never include microchip numbers or any client-identifying info; if mentioned, say "microchip recorded in Avimark."

Return ONLY the SOAP text with the six headings and nothing else.
      `.trim();

      const userPrompt = `JSON payload from the Lohit SOAP front-end:\n${JSON.stringify(
        payload,
        null,
        2
      )}`;

      resultText = await callOpenAI(systemPrompt, userPrompt);
    }

    // 2) CONSULT MODE
    else if (mode === "consult") {
      const systemPrompt = `
You are a veterinary consult helper for Dr. Lohit Busanelli.
Give practical, concise advice in plain text paragraphs or short lists.
Do NOT include SOAP headings here; just explain findings, differentials and next steps.
Keep it clinic-ready and assume the user is an experienced small animal vet.
      `.trim();

      resultText = await callOpenAI(systemPrompt, String(payload.message || ""));
    }

    // 3) TOOLBOX: BLOODWORK HELPER
    else if (mode === "toolbox-bloodwork") {
      const { text, detailLevel, includeDiffs, includeClientFriendly } =
        payload || {};

      const systemPrompt = `
You are Bloodwork Helper Lite for a small-animal veterinary clinic.
Input is pasted CBC/chem/UA text.

Output format:
1) "Clinical summary:" – 2–5 sentences.
2) If includeDiffs = true: "Key differentials:" – short numbered list.
3) If includeClientFriendly = true: "Client-friendly explanation:" – 1 short paragraph in simple language.

detailLevel:
- "short"    => 2–3 key points only.
- "standard" => more complete but still under ~250 words total.

Do NOT mention specific reference ranges unless they are in the text.
Never include microchip numbers or client identifiers.
      `.trim();

      const userPrompt = `detailLevel=${detailLevel}, includeDiffs=${includeDiffs}, includeClientFriendly=${includeClientFriendly}\n\nLab text:\n${text}`;
      resultText = await callOpenAI(systemPrompt, userPrompt);
    }

    // 4) TOOLBOX: EMAIL / CLIENT COMMUNICATION
    else if (mode === "toolbox-email") {
      const { emailType, petName, ownerName, timeframe, notes } = payload || {};

      const systemPrompt = `
You are the Email / Client Communication Helper for a veterinary clinic.
Generate a COMPLETE email body that staff can paste into their email client.
Do NOT add "Dear" line if the owner name is missing; just start with "Hi there,".

Tone: warm, clear, not overly formal.

Types:
- "bloodwork-followup": summarize that results are back, main findings, next steps.
- "dental-estimate": explain estimate ranges and that final cost depends on extractions etc.
- "vaccine-reminder": friendly reminder that vaccines are due.
- "general-update": generic medical update.

Always:
- Insert pet and owner names naturally if provided.
- Mention timeframe / when to book (timeframe string).
- End with a line about calling the clinic with any questions.
      `.trim();

      const userPrompt = `emailType=${emailType}\npetName=${petName}\nownerName=${ownerName}\ntimeframe=${timeframe}\nnotes=${notes}`;
      resultText = await callOpenAI(systemPrompt, userPrompt);
    }

    // Unknown mode
    else {
      resultText = "Error: Unknown mode parameter.";
    }

    res.json({ result: resultText });
  } catch (err) {
    console.error("Error in /api/run:", err);
    res.status(500).json({ result: "Server error while calling OpenAI." });
  }
});

app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.6 running on port ${PORT}`);
});