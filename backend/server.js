// server.js - Lohit SOAP backend (CommonJS)

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 👉 Paste your full SOAP brain rules here later
const SYSTEM_PROMPT = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli.
Use all clinic SOAP rules, surgery/dental templates, Avimark spacing rules,
and privacy rules. Do not invent client or pet names or microchip numbers.
`;

// Simple intake → text helper (same as earlier idea, just JSON stringify)
function buildIntakeText(body) {
  return JSON.stringify(body, null, 2);
}

app.post("/api/soap", async (req, res) => {
  try {
    const strictOrHelp = req.body.strictOrHelp || "help_me";
    const intakeText = buildIntakeText(req.body);

    const completion = await client.chat.completions.create({
      model: "gpt-5.1-thinking",
      temperature: strictOrHelp === "strict" ? 0.1 : 0.4,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content:
            "New intake from Lohit SOAP App. Mode: " +
            (req.body.mode || "unknown") +
            ". Strictness: " +
            strictOrHelp +
            ". Use all clinic rules and generate a single Avimark-compatible SOAP.\n\nINTAKE JSON:\n" +
            intakeText
        }
      ]
    });

    const soapText = completion.choices[0].message.content || "";
    res.json({ soap: soapText });
  } catch (err) {
    console.error("Error generating SOAP:", err);
    res.status(500).json({
      error: "Failed to generate SOAP",
      details: err.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Lohit SOAP backend is running.");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});