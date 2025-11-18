// Lohit SOAP App v1.6 backend (Assistant-integrated style)
// Simple Express server + /api/run endpoint for SOAP + Toolbox Lite + Consult.

const path = require("path");
const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Environment: your own API key + Assistant ID
const apiKey = process.env.OPENAI_API_KEY;
const assistantId = process.env.OPENAI_ASSISTANT_ID || "NOT_SET";

if (!apiKey) {
  console.warn("WARNING: OPENAI_API_KEY not set. /api/run calls will fail.");
}
if (!assistantId || assistantId === "NOT_SET") {
  console.warn("WARNING: OPENAI_ASSISTANT_ID not set. Using inline assistant rules only.");
}

const openai = new OpenAI({ apiKey });

app.use(express.json());

// Serve static files from project root (index.html, etc.)
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Helper: call OpenAI with a system + user prompt
async function callOpenAI(systemPrompt, userPrompt) {
  if (!apiKey) {
    return "Error: OPENAI_API_KEY is not set on the server.";
  }

  // NOTE: We conceptually "use" your Assistant by embedding its role and ID
  // into the system prompt. This keeps behavior stable even if Assistants API changes.
  const combinedSystemPrompt = `
You are Dr. Lohit Busanelli's dedicated veterinary Assistant (ID: ${assistantId}).

Follow the clinic's rules, templates, and SOAP formatting exactly.
If there is any conflict between older habits and the current instructions, always follow the current instructions below.

----- CURRENT INSTRUCTIONS -----
${systemPrompt}
  `.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: combinedSystemPrompt },
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

Rules:
- "soapType" in JSON will be "appointment" or "surgery".
- "strictMode" is a boolean:
  - strictMode = true  => do NOT invent new clinical data. If information is missing, say "Not recorded".
  - strictMode = false => you may use safe templated normals when needed but NEVER fabricate risky details (no made-up drugs, doses, or diagnostics). At the end of Assessment, add a short "Missing/Assumed:" line listing any assumptions.

For EVERY SOAP:
- Subjective:
  - Concise case summary + owner concerns.
  - Mention if this was a tech appointment vs doctor appointment if clear from payload.
- Objective:
  - Full PE list by system in this order:
    General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic, Diagnostics.
  - Bloodwork, imaging, and other tests here as data-only (no interpretation).
  - Oral:
    - If ageYears > 8 and no contradicting data: moderate tartar.
    - If ageYears > 4 and <= 8: mild tartar.
    - If user explicitly mentions different findings, follow that instead.
- Assessment:
  - Problem list + interpretations of diagnostics.
  - Include ASA class when soapType = "surgery" (use payload.asaStatus).
  - For multi-problem cases, clearly separate major problems.
- Plan:
  - Use numbered categories with ONE blank line between categories only (Avimark compatible):

    1. IV Catheter / Fluids
    2. Pre-medications
    3. Induction / Maintenance
    4. Surgical Prep
    5. Surgical Procedure
    6. Intra-op Medications
    7. Recovery
    8. Medications Dispensed
    9. Aftercare

  - Even for appointment SOAPs, keep this order but omit categories that truly do not apply (or mark "Not applicable").
  - In Plan: every drug must include name + dose + route + concentration in [brackets], e.g.: "Meloxicam [5 mg/ml] 0.2 mg/kg SQ".
  - Midazolam concentration is always written as [5 mg/ml] when used.
  - Do NOT include administration times.

- Surgery specifics (soapType = "surgery"):
  - Use template (canine spay, neuter, dental COHAT, mass removal, cystotomy, etc.) as guidance for default procedure description.
  - Always describe ET tube placement and IV catheter placement in Plan (not Objective).
  - Mention fluids and rates or "Fluids declined" if fluidsMode = "declined" or fluidsDeclined = true.
  - For standard dog neuters: use 2-0 Monocryl for most cases; use 0 Monocryl when weightKg > 35 unless override fields clearly say otherwise.
  - For dentals:
    - Mention monitoring (SpO2, ETCO2, blood pressure, ECG, IV fluids).
    - Mention local oral nerve blocks with lidocaine (dogs up to 4 mg/kg total, cats up to 2 mg/kg total) when implied by payload.
    - Say that extractions follow AAHA/AVDC standards when extractions are performed.
    - For flaps: "tension-free flap, no denuded bone, suture line not over defect" with 4-0 Monocryl simple interrupted.

- Formatting:
  - Single spacing inside each section.
  - No bullet symbols; use sentences or very short lines.
  - No extra blank lines except:
    - Between the six SOAP sections.
    - ONE blank line between each Plan category (1–9).
  - Never include microchip numbers, phone numbers, or client/owner names. If microchip is mentioned, say "microchip recorded in Avimark."

Return ONLY the SOAP text with the six headings in that order and nothing else.
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
Do NOT include SOAP headings here.
Assume the user is an experienced small animal vet.
      `.trim();

      const userPrompt = String(payload.message || "");
      resultText = await callOpenAI(systemPrompt, userPrompt);
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
- "standard" => more complete but still under about 250 words.

Do NOT mention specific reference ranges unless they are explicitly in the text.
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

Tone: warm, clear, not overly formal.

Types:
- "bloodwork-followup": summarize that results are back, main findings, next steps.
- "dental-estimate": explain estimate ranges and that final cost depends on extractions etc.
- "vaccine-reminder": friendly reminder that vaccines are due.
- "general-update": generic medical update.

Always:
- Insert pet and owner names naturally if provided (use "your pet" or "you" if missing).
- Mention timeframe / when to book (timeframe string, e.g. "within the next 1–2 weeks").
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