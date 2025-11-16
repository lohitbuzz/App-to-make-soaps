const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//
// 🔹 Stub SOAP endpoint
//
app.post("/api/generate-soap", (req, res) => {
  res.json({
    subjective: "Stub Subjective output (content coming soon)",
    objective: "Stub Objective output (content coming soon)",
    assessment: "Stub Assessment output (content coming soon)",
    plan: "Stub Plan output (content coming soon)",
    meds: "Stub Medications output (content coming soon)",
    aftercare: "Stub Aftercare output (content coming soon)"
  });
});

//
// 🔹 Stub Toolbox endpoint
//
app.post("/api/toolbox", (req, res) => {
  res.json({
    result: "Stub Toolbox result (processing coming soon)"
  });
});

//
// 🔹 Stub Feedback endpoint
//
app.post("/api/feedback", (req, res) => {
  console.log("Feedback received (stub):", req.body);
  res.json({ status: "Feedback received (stub)" });
});

//
// 🔹 Start server
//
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});