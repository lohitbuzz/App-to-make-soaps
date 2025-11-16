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
app.use(express.static(__dirname));

// ---------- HELPERS ----------
function buildPrompt(mode, payload) {
  if (mode === "soap") {
    const { soapType, strictMode, caseLabel, fields, refinementNote } = payload || {};
    const safeCaseLabel = caseLabel || "(no case label)";

    const strictText = strictMode
      ? "STRICT MODE: Do NOT invent missing data. Leave blanks or 'Not recorded.'"
      : "HELP ME MODE: You may use safe templated normals and clinic defaults. Mark anything assumed.";

    const baseRules = `
You are the Lohit SOAP App v1.6 assistant…

[ *** (rest of long prompt — keep entire block I gave you earlier) *** ]
`;

    return baseRules;
  }

  if (mode === "consult") {
    return `
You are Lohit's vet consult assistant.

Question:
${payload?.message || ""}
`;
  }

  if (mode === "toolbox-bloodwork") {
    const { text, detailLevel, includeDiffs, includeClientFriendly } = payload || {};
    return `
Bloodwork Helper Lite…

Source:
${text}
`;
  }

  if (mode === "toolbox-email") {
    return `
Quick vet client email…

Extra notes:
${payload?.notes || ""}
`;
  }

  return "Mode missing.";
}

// ---------- API ----------
app.post("/api/run", async (req, res) => {
  try {
    const { mode, payload } = req.body || {};
    const prompt = buildPrompt(mode, payload);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Lohit SOAP App v1.6 backend." },
        { role: "user", content: prompt },
      ],
    });

    return res.json({ result: completion.choices?.[0]?.message?.content || "" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "OpenAI request failed" });
  }
});

// ---------- START ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.6 running on port ${PORT}`);
});