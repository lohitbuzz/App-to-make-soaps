// /netlify/functions/feedback.js
// Moksha SOAP — Refinement Engine
// Assistant ID: asst_4sHUgx1lQ7Ob4KJtgkKQvsTb

import { OpenAI } from "openai";

export const config = {
  path: "/api/feedback",
};

export default async (req) => {
  try {
    if (req.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = JSON.parse(req.body);
    const { text, request, context } = body;

    if (!text || !request) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing text or request." }),
      };
    }

    // System prompt with clinic rules
    const systemPrompt = `
You are the Moksha SOAP Refinement Engine for a veterinary clinic.

Rules:
• Keep all medical facts EXACTLY the same.
• Improve clarity, flow, formatting, grammar.
• Maintain Avimark-safe format (no emojis, no special bullets).
• No hallucination. No adding missing vitals or data.
• If context = "soap" → keep SOAP structure exactly (S/O/A/P).
• If context = "toolbox" → keep short, clinical, vet-friendly.
• If context = "consult" → concise vet-to-vet tone.
    `;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `CONTEXT: ${context}\n\nREQUEST: ${request}\n\nTEXT TO REFINE:\n${text}`,
      },
    ];

    const result = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      max_tokens: 4000,
      temperature: 0.2,
    });

    const output =
      result.choices?.[0]?.message?.content?.trim() ||
      "Refinement produced no output.";

    return {
      statusCode: 200,
      body: JSON.stringify({ text: output }),
    };
  } catch (err) {
    console.error("FEEDBACK ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};