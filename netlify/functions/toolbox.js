import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}

function buildToolboxPrompt(body) {
  const { mode = "bloodwork-summary", text = "", notes = "", files = [] } = body;

  const fileSummary =
    files && files.length
      ? files.map((f) => `${f.name} (${f.type || "unknown"})`).join(", ")
      : "No files";

  if (mode === "soap-transform") {
    const { transformType = "summary", sourceText = "" } = body;
    return {
      role: "user",
      content: `
You are a veterinary documentation assistant. You are given a SOAP note as plain text
and asked to transform it in a specific way.

Transform type: ${transformType}

Rules:
- Preserve the underlying medical meaning.
- Do NOT invent new findings or treatments.
- Do NOT change drug names or dosages.
- You may reword for tone, length, or client-friendliness depending on the transform type.

Transform types:
- "email": create a client-friendly email body explaining the visit, findings, and plan.
- "summary": create a short, vet-facing summary (3–6 sentences).
- "handout": create a client handout-style paragraph or two, in plain language.
- "plan-meds-aftercare": extract the Plan + medications + aftercare content only, in Avimark-friendly text.
- "rephrase": keep same structure and content but make wording slightly more concise and polished.

SOAP to transform:
${sourceText}
`,
    };
  }

  let taskDescription = "";
  if (mode === "bloodwork-summary") {
    taskDescription = `Summarize the key abnormalities and their likely significance in 2–4 sentences, veterinarian-facing.`;
  } else if (mode === "lab-interpretation") {
    taskDescription = `Provide a more detailed interpretation (1–2 short paragraphs) of the lab results, including likely differentials and suggested next steps.`;
  } else if (mode === "client-email") {
    taskDescription = `Write a client-friendly email explaining what these results mean, what we're doing about it, and what to watch for at home.`;
  } else if (mode === "weight-consult") {
    taskDescription = `Create a weight maintenance / weight management handout in the style of an organized vet clinic document (similar to Wonton’s weight consult): include sections for current status, daily calories, food amounts, treats guidelines, exercise, and recheck timing.`;
  } else {
    taskDescription = `Perform the transformation or help requested in plain language. The user may have asked for bullet points, a summary, a rewrite, etc.`;
  }

  return {
    role: "user",
    content: `
You are a small-animal veterinary "Toolbox" helper.

Task:
${taskDescription}

Guidelines:
- Assume the reader is another veterinarian, EXCEPT when the task is clearly client-facing (like client-email or weight-consult).
- Do not invent new lab values or clinical data beyond what would be standard context.
- When medications are mentioned, include drug concentrations in brackets if known, but do NOT fabricate specific mg/kg doses that are not hinted at.
- Keep output Avimark-friendly (plain text and line breaks only).

Additional instructions from vet:
${notes || "(none)"}

Pasted text (CBC/chem/UA/notes or other input):
${text || "(none provided)"}

Attached files (names only):
${fileSummary}
`,
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const userMessage = buildToolboxPrompt(body);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a veterinary documentation and communication helper (Toolbox) for a busy small-animal clinic.",
        },
        userMessage,
      ],
    });

    const result = completion.choices?.[0]?.message?.content || "";
    return jsonResponse(200, { ok: true, result });
  } catch (err) {
    console.error("Toolbox function error:", err);
    return jsonResponse(500, { error: "Failed to run Toolbox" });
  }
}
