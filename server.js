const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

const app = express();

// ---------- OPENAI CLIENT ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- MIDDLEWARE ----------
app.use(bodyParser.json());
// serve static files (index.html, app.js, style.css) from this folder
app.use(express.static(__dirname));

// ---------- HELPERS ----------

// Build a big text prompt the model can work from
function buildPrompt(mode, payload) {
  if (mode === "soap") {
    const { soapType, strictMode, caseLabel, fields, refinementNote } = payload || {};
    const safeCaseLabel = caseLabel || "(no case label)";

    const strictText = strictMode
      ? "STRICT MODE: Do NOT invent missing data. Leave obvious blanks and say 'Not recorded' instead of guessing."
      : "HELP ME MODE: You may use safe templated normals and clinic defaults, but clearly mark anything assumed or templated. Do NOT invent lab values, radiology findings, cytology you were not given, or client decisions.";

    const baseRules = `
You are the Lohit SOAP App v1.6 assistant for a small animal veterinary clinic.
Make an Avimark-compatible SOAP note following these strict rules:

- Sections in this order: Subjective, Objective, Assessment, Plan, Medications Dispensed, Aftercare.
- One blank line BETWEEN sections, but NO extra blank lines inside a section.
- Appointment and surgery follow clinic's default templates.
- Objective physical exam: use full system-based PE (General, Vitals, Eyes, Ears, Oral, Nose, Resp, CV, Abd, UG, MSK, Neuro, Integ, Lymph).
- Oral default: calculus/gingivitis absent; if clearly older (>4–8y) and indicated by context you may mention mild/moderate tartar, but never heavy disease unless described.
- Bloodwork summaries belong ONLY in Objective as data-only; interpretation goes in Assessment.
- Assessment: problem list + differentials + anesthesia grade if surgical.
- PLAN ORDER for any surgical/anesthetic case:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- Always include drug concentrations in [brackets] whenever mentioned.
- Midazolam concentration is always written as [5 mg/ml].
- No exact administration times, only drugs, doses, routes.
- Use single spacing and simple bullet/numbering that will paste cleanly into Avimark.
- Close with a concise Aftercare section (restrictions, monitoring, recheck, warning signs).

For dental or extraction content (when present in the case):
- Mention monitoring: SpO2, ETCO2, blood pressure, ECG, and fluids.
- Assume local oral nerve blocks (lidocaine up to 4 mg/kg in dogs, 2 mg/kg in cats) when clearly appropriate.
- For extractions, mention AAHA/AVDC standard approach and closure phrase:
  "tension-free flap, no denuded bone, suture line not over defect" with 4-0 Monocryl in a simple interrupted pattern.

For surgery templates (spay/neuter/mass/dental/etc.):
- Include ASA status in Assessment for anesthetic cases.
- Respect suture defaults: Monocryl for closure, with the clinic's usual pattern (SC + intradermal, no external sutures) unless told otherwise.

${strictText}

Now create a SOAP for this case.
SOAP TYPE: ${soapType}
CASE LABEL: ${safeCaseLabel}
REFINEMENT NOTE (can be 'null' if first pass): ${refinementNote || "(none provided)"}

Raw fields from the UI (use what you need, do not repeat labels literally):

Reason for visit: ${fields?.reason || fields?.template || "(not provided)"}
TPR: ${fields?.tpr || "(not provided)"}
History / Subjective: ${fields?.history || "(not provided)"}
Physical exam (data-only): ${fields?.physicalExam || "(not provided)"}
Diagnostics (data-only): ${fields?.diagnostics || "(not provided)"}
Assessment notes: ${fields?.assessment || "(not provided)"}
Plan notes: ${fields?.plan || "(not provided)"}
Medications dispensed (raw list): ${fields?.meds || "(not provided)"}

Surgery-only extra fields (ignore if not a surgery case):
- ASA: ${fields?.asa || "(n/a)"}
- ET tube size: ${fields?.ett || "(n/a)"}
- IV catheter details: ${fields?.catheter || "(n/a)"}
- Fluids rate (ml/kg/hr): ${fields?.fluidsRate || "(n/a)"}
- Fluids declined? ${fields?.fluidsDeclined ? "Yes" : "No / not specified"}
- Premeds: ${fields?.premeds || "(n/a)"}
- Induction / Maintenance: ${fields?.induction || "(n/a)"}
- Intra-op medications: ${fields?.intraOpMeds || "(n/a)"}
- Procedure notes: ${fields?.procedureNotes || "(n/a)"}
- Monocryl override checkboxes:
   - 0: ${fields?.monocryl0 ? "checked" : "no"}
   - 2-0: ${fields?.monocryl2_0 ? "checked" : "no"}
   - 3-0: ${fields?.monocryl3_0 ? "checked" : "no"}
- TPR (surgical): ${fields?.tpr || "(n/a)"}
- Duration notes: ${fields?.durations || "(n/a)"}

Now output ONLY the SOAP text with the six sections, in order, each labelled like:
Subjective:
Objective:
Assessment:
Plan:
Medications Dispensed:
Aftercare:
`;

    return baseRules;
  }

  if (mode === "consult") {
    const question = payload?.message || "";
    return `
You are Lohit's veterinary consult assistant. Give concise, practical guidance for a small animal GP vet in Ontario.
Assume the user understands basic medicine; focus on differentials, next diagnostics, treatment options, and client communication.
Answer in paragraph + short bullet points, Avimark-pastable.

Question:
${question}
`;
  }

  if (mode === "toolbox-bloodwork") {
    const { text, detailLevel, includeDiffs, includeClientFriendly } = payload || {};
    return `
You are "Bloodwork Helper Lite" for Lohit's clinic.

Source text (lab values, comments, etc.):
---
${text}
---

Detail level: ${detailLevel} (short = 1–2 sentences; standard = a short paragraph)
Include differentials list? ${includeDiffs ? "Yes, include 3–5 likely differentials per key problem" : "No, keep it brief."}
Client-friendly explanation requested? ${includeClientFriendly ? "Yes, include a second, simple paragraph suitable to paste into an email or discharge." : "No, vet-facing only."}

Output format:

1) "Vet summary:" followed by 1–2 short paragraphs in vet language.
${includeDiffs ? "2) 'Differentials:' bullet list grouped by main abnormality." : ""}
${includeClientFriendly ? "3) 'Client-friendly summary:' 1 short paragraph in simple language." : ""}

No headings other than those labels. Avimark-compatible text only.
`;
  }

  if (mode === "toolbox-email") {
    const { emailType, petName, ownerName, timeframe, notes } = payload || {};
    return `
You write quick, friendly, professional veterinary client emails that paste cleanly into Avimark.

Email type: ${emailType} (e.g., bloodwork follow-up, dental estimate, vaccine reminder)
Pet name: ${petName || "(pet name not given)"}
Owner name: ${ownerName || "(owner name not given)"}
Timeframe / appointment info: ${timeframe || "(not specified)"}
Extra notes from vet: ${notes || "(none)"}

Write:
- A short email body only (no "To:" or signatures, just the message).
- Warm but efficient, low-drama, clear next steps.
- Canadian spelling is okay; avoid medical jargon unless necessary.
- Assume clinic will add their standard signature.

Text should be ready to paste straight into an email template field.
`;
  }

  return "You are a helpful veterinary assistant. The clinic forgot to specify mode; answer briefly and clearly.";
}

// ---------- API ROUTE ----------
app.post("/api/run", async (req, res) => {
  try {
    const { mode, payload } = req.body || {};
    if (!mode) {
      return res.status(400).json({ error: "Missing mode" });
    }

    const prompt = buildPrompt(mode, payload);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are the backend brain of the Lohit SOAP App v1.6. Always follow the clinic formatting rules and Avimark spacing requirements.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return res.json({ result: text });
  } catch (err) {
    console.error("Error in /api/run:", err);
    return res.status(500).json({ error: "OpenAI request failed" });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.6 running on port ${PORT}`);
});