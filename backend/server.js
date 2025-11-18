const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// —————————————————————————————
// SYSTEM BRAIN PROMPT
// —————————————————————————————

const SYSTEM_PROMPT = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli.
Follow all Master Rules, surgery templates, dental templates,
drug formatting, ASA handling, Avimark spacing rules, and
clinic privacy rules from November 2024–2025.

Never create client/pet names or microchip numbers.
Always format SOAPs exactly as the clinic requires.
Include Plan categories in correct order.
Include drug concentrations in brackets.
Never invent vitals in strict mode.
Return Avimark-friendly plain text.
`;

// Helper – stringify intake cleanly
function buildIntakeText(body) {
  return JSON.stringify(body, null, 2);
}

// Health check
app.get("/", (req, res) => {
  res.send("Lohit SOAP backend running.");
});

// —————————————————————————————
// MAIN ROUTE — /api/soap
// —————————————————————————————

app.post("/api/soap", async (req, res) => {
  try {
    const { strictOrHelp = "help_me", ...rest } = req.body;
    const intake = buildIntakeText(rest);

    const completion = await client.chat.completions.create({
      model: "gpt-5.1-thinking",
      temperature: strictOrHelp === "strict" ? 0.1 : 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Incoming data from Lohit SOAP App.\nStrictness=${strictOrHelp}\n\n${intake}`
        }
      ]
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No response from model.";

    return res.json({ ok: true, result: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Server error generating SOAP"
    });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});