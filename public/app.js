// ---------- TAB SWITCHING ----------
function showTab(tabId) {
  const ids = ["soap", "toolbox", "feedback"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === tabId ? "block" : "none";
  });

  const modeLabel = document.getElementById("modeLabel");
  if (!modeLabel) return;
  if (tabId === "soap") {
    modeLabel.innerText = "Mode: SOAP Generator";
  } else if (tabId === "toolbox") {
    modeLabel.innerText = "Mode: Toolbox (helpers)";
  } else if (tabId === "feedback") {
    modeLabel.innerText = "Mode: Feedback & training";
  }
}

// ---------- HELPERS ----------

function getSoapSectionsFromDOM() {
  return {
    Subjective: document.getElementById("oSubjective")?.innerText || "",
    Objective: document.getElementById("oObjective")?.innerText || "",
    Assessment: document.getElementById("oAssessment")?.innerText || "",
    Plan: document.getElementById("oPlan")?.innerText || "",
    "Medications Dispensed":
      document.getElementById("oMeds")?.innerText || "",
    Aftercare: document.getElementById("oAftercare")?.innerText || ""
  };
}

function parseSoapTextToSections(text) {
  const sections = {
    Subjective: "",
    Objective: "",
    Assessment: "",
    Plan: "",
    "Medications Dispensed": "",
    Aftercare: ""
  };

  let current = null;
  text.split(/\r?\n/).forEach((line) => {
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
      sections[current] += (sections[current] ? "\n" : "") + trimmed;
    }
  });

  // Fallback: if parsing fails, put everything in Subjective
  const anyFilled =
    sections.Subjective ||
    sections.Objective ||
    sections.Assessment ||
    sections.Plan ||
    sections["Medications Dispensed"] ||
    sections.Aftercare;
  if (!anyFilled && text.trim()) {
    sections.Subjective = text.trim();
  }

  return sections;
}

function setSoapSectionsToDOM(sections, updatedKeys = []) {
  const map = {
    Subjective: "oSubjective",
    Objective: "oObjective",
    Assessment: "oAssessment",
    Plan: "oPlan",
    "Medications Dispensed": "oMeds",
    Aftercare: "oAftercare"
  };

  Object.keys(map).forEach((key) => {
    const el = document.getElementById(map[key]);
    if (!el) return;
    el.innerText = sections[key] || "";

    el.classList.remove("updated");
    if (updatedKeys.includes(key)) {
      el.classList.add("updated");
      setTimeout(() => el.classList.remove("updated"), 2000);
    }
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.error("Clipboard error:", e);
  }
}

// ---------- SOAP ----------

async function generateSOAP() {
  const btn = document.getElementById("btnGenerateSoap");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Generating…";
  }

  const payload = {
    caseLabel: document.getElementById("caseLabel")?.value || "",
    type: document.getElementById("soapType")?.value || "",
    template: document.getElementById("soapTemplate")?.value || "",
    reason: document.getElementById("reason")?.value || "",
    planNotes: document.getElementById("planInput")?.value || "",
    accuracyMode: document.getElementById("accuracyMode")?.value || "medium"
  };

  try {
    const res = await fetch("/api/soap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const text = data.soapText || data.soap || "";

    const sections = parseSoapTextToSections(text);
    setSoapSectionsToDOM(sections, [
      "Subjective",
      "Objective",
      "Assessment",
      "Plan",
      "Medications Dispensed",
      "Aftercare"
    ]);
  } catch (err) {
    console.error(err);
    if (document.getElementById("oSubjective")) {
      document.getElementById("oSubjective").innerText =
        "Error generating SOAP.";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Generate SOAP";
    }
  }
}

async function refineSOAP() {
  const btn = document.getElementById("btnRefineSoap");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Refining…";
  }

  const feedback = document.getElementById("refineFeedback")?.value || "";

  const sectionsToRefine = [];
  if (document.getElementById("refineSubjective")?.checked) {
    sectionsToRefine.push("Subjective");
  }
  if (document.getElementById("refineObjective")?.checked) {
    sectionsToRefine.push("Objective");
  }
  if (document.getElementById("refineAssessment")?.checked) {
    sectionsToRefine.push("Assessment");
  }
  if (document.getElementById("refinePlan")?.checked) {
    sectionsToRefine.push("Plan");
  }
  if (document.getElementById("refineMeds")?.checked) {
    sectionsToRefine.push("Medications Dispensed");
  }
  if (document.getElementById("refineAftercare")?.checked) {
    sectionsToRefine.push("Aftercare");
  }

  if (!sectionsToRefine.length) {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Refine Selected Sections";
    }
    return;
  }

  const currentSections = getSoapSectionsFromDOM();

  const payload = {
    sections: currentSections,
    feedback,
    sectionsToRefine,
    accuracyMode:
      document.getElementById("accuracyMode")?.value || "medium",
    meta: {
      caseLabel: document.getElementById("caseLabel")?.value || "",
      type: document.getElementById("soapType")?.value || "",
      template: document.getElementById("soapTemplate")?.value || ""
    }
  };

  try {
    const res = await fetch("/api/refine-soap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const text = data.soapText || data.soap || "";
    const newSections = parseSoapTextToSections(text);

    // Only highlight the sections chosen, but update all
    setSoapSectionsToDOM(newSections, sectionsToRefine);
  } catch (err) {
    console.error(err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Refine Selected Sections";
    }
  }
}

// ---------- COPY FUNCTIONS ----------

function copyFullSOAP() {
  const sections = getSoapSectionsFromDOM();
  const order = [
    "Subjective",
    "Objective",
    "Assessment",
    "Plan",
    "Medications Dispensed",
    "Aftercare"
  ];
  const parts = order.map((key) => {
    const value = sections[key] || "";
    return `${key}:\n${value}`.trim();
  });
  const text = parts.join("\n\n").trim();
  if (text) copyToClipboard(text);
}

function copySection(sectionName) {
  const map = {
    Subjective: "oSubjective",
    Objective: "oObjective",
    Assessment: "oAssessment",
    Plan: "oPlan",
    "Medications Dispensed": "oMeds",
    Aftercare: "oAftercare"
  };
  const id = map[sectionName];
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.innerText || "";
  if (!text.trim()) return;
  copyToClipboard(text.trim());
}

function copyPlanMedsAftercare() {
  const sections = getSoapSectionsFromDOM();
  const parts = [
    `Plan:\n${sections.Plan || ""}`.trim(),
    `Medications Dispensed:\n${sections["Medications Dispensed"] || ""}`.trim(),
    `Aftercare:\n${sections.Aftercare || ""}`.trim()
  ];
  const text = parts.join("\n\n").trim();
  if (text) copyToClipboard(text);
}

// ---------- TOOLBOX ----------

function updateToolboxModeUI() {
  const mode = document.getElementById("toolboxMode")?.value || "freeform";
  const emailFields = document.getElementById("toolboxEmailFields");
  if (!emailFields) return;
  if (mode === "client_email") {
    emailFields.style.display = "block";
  } else {
    emailFields.style.display = "none";
  }
}

async function processToolbox() {
  const btn = document.getElementById("btnToolbox");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Processing…";
  }

  const mode = document.getElementById("toolboxMode")?.value || "freeform";
  const detailLevel =
    document.getElementById("toolboxDetail")?.value || "standard";
  const text = document.getElementById("toolboxInput")?.value || "";
  const clinic = document.getElementById("toolboxClinic")?.value || "";
  const fromName = document.getElementById("toolboxFrom")?.value || "";

  const payload = {
    mode,
    detailLevel,
    text,
    clinic,
    fromName
  };

  try {
    const res = await fetch("/api/toolbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    document.getElementById("toolboxOutput").innerText =
      data.output || JSON.stringify(data, null, 2);
  } catch (err) {
    console.error(err);
    document.getElementById("toolboxOutput").innerText =
      "Error in toolbox.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Process";
    }
  }
}

async function sendToolboxFeedback() {
  const btn = document.getElementById("btnToolboxFeedback");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Sending…";
  }

  const feedbackText =
    document.getElementById("toolboxFeedbackText")?.value || "";
  const mode = document.getElementById("toolboxMode")?.value || "freeform";
  const inputText =
    document.getElementById("toolboxInput")?.value || "";
  const outputText =
    document.getElementById("toolboxOutput")?.innerText || "";

  const payload = {
    mode,
    feedback: feedbackText,
    input: inputText,
    output: outputText
  };

  try {
    const res = await fetch("/api/toolbox-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    document.getElementById("toolboxFeedbackStatus").innerText =
      data.message || data.status || "Feedback sent.";
  } catch (err) {
    console.error(err);
    document.getElementById("toolboxFeedbackStatus").innerText =
      "Error sending toolbox feedback.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Send toolbox feedback";
    }
  }
}

// ---------- FEEDBACK (GLOBAL) ----------

async function sendFeedback() {
  const btn = document.getElementById("btnFeedback");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Sending…";
  }

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
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Submit Feedback";
    }
  }
}

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  const toolboxMode = document.getElementById("toolboxMode");
  if (toolboxMode) {
    toolboxMode.addEventListener("change", updateToolboxModeUI);
    updateToolboxModeUI();
  }
});
