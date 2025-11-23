// /netlify/functions/soap.js
// Moksha SOAP — Netlify Function
// Assistant ID: asst_4sHUgx1lQ7Ob4KJtgkKQvsTb

import { OpenAI } from "openai";

export const config = {
  path: "/api/soap",
};

export default async (req) => {
  try {
    if (req.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed",
      };
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = JSON.parse(req.body);

    const {
      mode,
      caseType,
      appointment,
      surgery,
      images = [],
      transcript = "",
    } = body;

    // Build system prompt
    const systemPrompt = `
You are the Moksha SOAP clinical engine for a small-animal veterinary clinic.
You strictly follow these rules:

• ALWAYS output a full Avimark-compatible SOAP.
• NO blank lines inside categories; ONE blank line between Plan sections.
• Objective PE uses Lohit’s full template.
• Bloodwork in Objective is DATA ONLY. Interpretation ONLY in Assessment.
• All surgery SOAPs follow the clinic’s surgical Plan category order.
• Include concentrations in brackets for all drugs in Plan.
• Never invent data unless "Help Me" mode is selected. In Strict mode, output "__" for missing.
• If transcript is provided and “useTranscriptForSoap”=true, absorb its content exactly.

CASE TYPE = ${caseType.toUpperCase()}
MODE = ${mode}
    `;

    // Assemble user content (appointment or surgery)
    let userPrompt = "";

    if (caseType === "appointment") {
      userPrompt = `
APPOINTMENT INPUTS:
Reason: ${appointment.reason || ""}
History: ${appointment.history || ""}
PE: ${appointment.pe || ""}
Diagnostics: ${appointment.diagnostics || ""}
Assessment Hints: ${appointment.assessmentHints || ""}
Plan Hints: ${appointment.planHints || ""}
Meds Hints: ${appointment.medsDispensedHints || ""}

Transcript (if any):
${transcript}
      `;
    } else {
      userPrompt = `
SURGERY INPUTS:
Reason: ${surgery.reason || ""}
History: ${surgery.history || ""}
PE: ${surgery.pe || ""}
Diagnostics: ${surgery.diagnostics || ""}
Procedure Notes: ${surgery.procedureNotes || ""}
Recovery Notes: ${surgery.recovery || ""}
Meds Dispensed Hints: ${surgery.medsDispensedHints || ""}

Transcript (if any):
${transcript}
      `;
    }

    // Build message list
    let messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Attach images/files to messages
    for (const file of images) {
      messages.push({
        role: "user",
        content: [
          { type: "input_text", text: "Attached file for vision analysis" },
          {
            type: "input_image",
            image_url: file.data,
          },
        ],
      });
    }

    // Call Assistant
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      max_tokens: 5000,
      temperature: 0.4,
    });

    const outputText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Error: no content returned.";

    return {
      statusCode: 200,
      body: JSON.stringify({ text: outputText }),
    };
  } catch (err) {
    console.error("SOAP ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};