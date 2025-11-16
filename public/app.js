function showTab(tab) {
  document.querySelectorAll(".tab").forEach(t => (t.style.display = "none"));
  document.getElementById(tab).style.display = "block";
}

// --- SOAP ---

async function generateSOAP() {
  const payload = {
    caseLabel: document.getElementById("caseLabel")?.value || "",
    type: document.getElementById("soapType")?.value || "",
    template: document.getElementById("soapTemplate")?.value || "",
    reason: document.getElementById("reason")?.value || "",
    planNotes: document.getElementById("planInput")?.value || ""
  };

  try {
    const res = await fetch("/api/soap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const text = data.soapText || data.soap || "";

    // Try to split into sections
    const sections = {
      Subjective: "",
      Objective: "",
      Assessment: "",
      Plan: "",
      "Medications Dispensed": "",
      Aftercare: ""
    };

    let current = null;

    text.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const m = /^([A-Za-z ]+):\s*(.*)$/.exec(trimmed);
      if (m && sections.hasOwnProperty(m[1])) {
        current = m[1];
        const rest = m[2];
        if (rest) {
          sections[current] += (sections[current] ? "\n" : "") + rest;
        }
      } else if (current) {
        sections[current] +=
          (sections[current] ? "\n" : "") + trimmed;
      }
    });

    // Fallback: if we couldn't parse, just dump everything into Subjective
    if (!sections.Subjective && !sections.Objective && !sections.Assessment) {
      sections.Subjective = text;
    }

    document.getElementById("oSubjective").innerText =
      sections.Subjective || "";
    document.getElementById("oObjective").innerText =
      sections.Objective || "";
    document.getElementById("oAssessment").innerText =
      sections.Assessment || "";
    document.getElementById("oPlan").innerText = sections.Plan || "";
    document.getElementById("oMeds").innerText =
      sections["Medications Dispensed"] || "";
    document.getElementById("oAftercare").innerText =
      sections.Aftercare || "";
  } catch (err) {
    console.error(err);
    document.getElementById("oSubjective").innerText =
      "Error generating SOAP.";
  }
}

// --- TOOLBOX ---

async function processToolbox() {
  const input = document.getElementById("toolboxInput")?.value || "";

  try {
    const res = await fetch("/api/toolbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input })
    });

    const data = await res.json();
    document.getElementById("toolboxOutput").innerText =
      data.output || JSON.stringify(data, null, 2);
  } catch (err) {
    console.error(err);
    document.getElementById("toolboxOutput").innerText =
      "Error in toolbox.";
  }
}

// --- FEEDBACK ---

async function sendFeedback() {
  const type = document.getElementById("feedbackType")?.value || "";
  const text = document.getElementById("feedbackText")?.value || "";

  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, text })
    });

    const data = await res.json();
    document.getElementById("feedbackStatus").innerText =
      data.message || data.status || "Feedback sent.";
  } catch (err) {
    console.error(err);
    document.getElementById("feedbackStatus").innerText =
      "Error sending feedback.";
  }
}
