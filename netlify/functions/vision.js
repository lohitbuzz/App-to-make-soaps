// /netlify/functions/vision.js
// Moksha SOAP — Vision function
// Assistant ID: asst_4sHUgx1lQ7Ob4KJtgkKQvsTb

import { OpenAI } from "openai";

export const config = {
  path: "/api/vision",
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
    const { prompt, images = [] } = body;

    // System prompt for Vision
    const systemPrompt = `
You are the Moksha SOAP Vision Engine for a veterinary clinic.

Rules:
• If images show bloodwork → extract values + list abnormalities + give 2 versions (SOAP-ready + Client-friendly).
• If images show labwork → summarize findings + list differentials.
• If radiographs → describe findings in plain English only.
• If cytology → summarize organisms + inflammation + cell types.
• NEVER invent values; if unreadable, write “unreadable”.
• Always produce concise, Avimark-safe formatting.
• No bullet symbols except hyphens ("-"). No emojis in final output.
    `;

    // Build message list
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: prompt || "Analyze the attached files.",
      },
    ];

    // Attach each file
    for (const file of images) {
      messages.push({
        role: "user",
        content: [
          { type: "input_text", text: "Attached file for analysis" },
          { type: "input_image", image_url: file.data },
        ],
      });
    }

    // Run Vision request
    const result = await openai.chat.completions.create({
      model: "gpt-4.1-vision-preview",
      messages,
      max_tokens: 4000,
      temperature: 0.3,
    });

    const output =
      result.choices?.[0]?.message?.content?.trim() ||
      "Vision engine returned no text.";

    return {
      statusCode: 200,
      body: JSON.stringify({ text: output }),
    };
  } catch (err) {
    console.error("VISION ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};