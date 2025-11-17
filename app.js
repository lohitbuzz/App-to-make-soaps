// app.js
// Frontend logic for Lohit SOAP App v1.6
// Works with server.js /api/run endpoint.

// ====== Config ======
const API_ENDPOINT = "/api/run";

// ====== DOM helpers ======
const $ = (id) => document.getElementById(id);

// Sections & tabs
const sections = {
  appointmentSection: $("appointmentSection"),
  surgerySection: $("surgerySection"),
  consultSection: $("consultSection"),
  toolboxSection: $("toolboxSection"),
};

const tabButtons = document.querySelectorAll(".tab");

// Shared UI
const statusText = $("statusText");
const modeSelect = $("modeSelect");
const caseLabelInput = $("caseLabel");

// Appointment inputs
const appointmentReason = $("appointmentReason");
const appointmentTpr = $("appointmentTpr");
const appointmentHistory = $("appointmentHistory");
const appointmentPe = $("appointmentPe");
const appointmentDiagnostics = $("appointmentDiagnostics");
const appointmentAssessment = $("appointmentAssessment");
const appointmentPlan = $("appointmentPlan");
const appointmentMeds = $("appointmentMeds");
const appointmentAttachments = $("appointmentAttachments");
const generateAppointmentBtn = $("generateAppointmentBtn");

// Surgery inputs
const surgeryTemplate = $("surgeryTemplate");
const surgeryTemplateDescription = $("surgeryTemplateDescription");
const asaStatus = $("asaStatus");
const ivCatheter = $("ivCatheter");
const etTube = $("etTube");
const fluidRate = $("fluidRate");
const fluidsDeclined = $("fluidsDeclined");
const premedications = $("premedications");
const induction = $("induction");
const intraopMeds = $("intraopMeds");
const procedureNotes = $("procedureNotes");
const tprNotes = $("tprNotes");
const durationNotes = $("durationNotes");
const monocryl0 = $("monocryl0");
const monocryl2_0 = $("monocryl2_0");
const monocryl3_0 = $("monocryl3_0");
const surgeryAttachments = $("surgeryAttachments");
const generateSurgeryBtn = $("generateSurgeryBtn");

// Consult
const consultAttachments = $("consultAttachments");
const consultInput = $("consultInput");
const consultOutput = $("consultOutput");
const runConsultBtn = $("runConsultBtn");

// Toolbox Lite – bloodwork
const toolboxAttachments = $("toolboxAttachments");
const toolboxLabText = $("toolboxLabText");
const toolboxDetailLevel = $("toolboxDetailLevel");
const toolboxIncludeDifferentials = $("toolboxIncludeDifferentials");
const toolboxClientSummary = $("toolboxClientSummary");
const runBloodworkHelperBtn = $("runBloodworkHelperBtn");
const toolboxBloodworkOutput = $("toolboxBloodworkOutput");

// SOAP output areas
const subjectiveOutput = $("subjectiveOutput");
const objectiveOutput = $("objectiveOutput");
const assessmentOutput = $("assessmentOutput");
const planOutput = $("planOutput");
const medsOutput = $("medsOutput");
const aftercareOutput = $("aftercareOutput");

// Copy buttons
const copySubjectiveBtn = $("copySubjectiveBtn");
const copyObjectiveBtn = $("copyObjectiveBtn");
const copyAssessmentBtn = $("copyAssessmentBtn");
const copyPlanBtn = $("copyPlanBtn");
const copyMedsBtn = $("copyMedsBtn");
const copyAftercareBtn = $("copyAftercareBtn");
const copyFullSoapBtn = $("copyFullSoapBtn");
const copyPlanMedsAftercareBtn = $("copyPlanMedsAftercareBtn");

// Mic + QR
const micButton = $("micButton");
const qrContainer = $("qrContainer");

// Track last-focused input for mic
let lastFocusedEditable = null;

// ====== Utility helpers ======

function setStatus(msg) {
  if (statusText) statusText.textContent = msg;
}

function getUiMode() {
  // whatever values you used ("help", "strict", etc.)
  return (modeSelect && modeSelect.value) || "help";
}

function isStrictMode() {
  // treat any value literally equal to "strict" as strict mode
  return getUiMode() === "strict";
}

function getCaseLabel() {
  return (caseLabelInput && caseLabelInput.value) || "";
}

function getFileNames(inputEl) {
  if (!inputEl || !inputEl.files) return [];
  return Array.from(inputEl.files).map((f) => f.name);
}

// Call backend /api/run
async function callBackend(mode, payload) {
  const body = { mode, payload };
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.result || "";
}

// Parse SOAP text blob into 6 sections
function parseSoapText(text) {
  const sections = [
    "Subjective",
    "Objective",
    "Assessment",
    "Plan",
    "Medications Dispensed",
    "Aftercare",
  ];

  const map = {
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    meds: "",
    aftercare: "",
  };

  if (!text || typeof text !== "string") {
    return map;
  }

  // Find positions of each heading
  const markers = [];
  sections.forEach((name) => {
    const label = `${name}:`;
    const idx = text.indexOf(label);
    if (idx !== -1) {
      markers.push({ name, idx, labelLen: label.length });
    }
  });

  if (!markers.length) {
    // fallback: shove everything into Plan
    map.plan = text.trim();
    return map;
  }

  markers.sort((a, b) => a.idx - b.idx);

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const start = current.idx + current.labelLen;
    const end = next ? next.idx : text.length;
    const content = text.slice(start, end).trim();

    switch (current.name) {
      case "Subjective":
        map.subjective = content;
        break;
      case "Objective":
        map.objective = content;
        break;
      case "Assessment":
        map.assessment = content;
        break;
      case "Plan":
        map.plan = content;
        break;
      case "Medications Dispensed":
        map.meds = content;
        break;
      case "Aftercare":
        map.aftercare = content;
        break;
      default:
        break;
    }
  }

  return map;
}

function fillSoapOutputsFromText(text) {
  const parsed = parseSoapText(text);
  subjectiveOutput.value = parsed.subjective || "";
  objectiveOutput.value = parsed.objective || "";
  assessmentOutput.value = parsed.assessment || "";
  planOutput.value = parsed.plan || "";
  medsOutput.value = parsed.meds || "";
  aftercareOutput.value = parsed.aftercare || "";
}

async function handleCopy(text) {
  try {
    await navigator.clipboard.writeText(text || "");
  } catch (err) {
    console.error("Clipboard error:", err);
  }
}

// ====== Tabs ======
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-tab");
    if (!targetId) return;

    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    Object.entries(sections).forEach(([id, el]) => {
      if (!el) return;
      if (id === targetId) el.classList.remove("hidden");
      else el.classList.add("hidden");
    });
  });
});

// ====== QR code ======
function initQr() {
  if (!qrContainer) return;
  qrContainer.innerHTML = "";
  // global QRCode from index.html script
  // eslint-disable-next-line no-undef
  new QRCode(qrContainer, {
    text: window.location.href,
    width: 180,
    height: 180,
  });
}

// ====== Surgery template descriptions & small logic ======

const surgeryTemplateDescriptions = {
  canine_neuter_clinic:
    "Prescrotal canine neuter using clinic protocol; default 2-0 Monocryl (<35 kg) or 0 Monocryl (>35 kg) unless overridden.",
  canine_neuter_rescue:
    "Rescue canine neuter using clinic rescue protocol; default 2-0 Monocryl (<35 kg) or 0 Monocryl (>35 kg).",
  canine_spay_clinic:
    "Standard canine OHE per clinic protocol; 2-0 Monocryl for body wall, 3-0 for intradermal skin unless overridden.",
  canine_spay_rescue:
    "Rescue canine spay with clinic rescue analgesia and closure protocols.",
  feline_neuter:
    "Standard feline scrotal neuter; 3-0 or 4-0 absorbable ligatures per clinic protocol.",
  feline_spay:
    "Feline OHE per clinic protocol; typically 3-0 Monocryl, simple continuous fascia and intradermal skin.",
  dental_cohat_rads:
    "COHAT with full-mouth radiographs and local nerve blocks; mention AAHA/AVDC extraction standards if extractions performed.",
  dental_cohat_no_rads:
    "COHAT without radiographs; note radiographs declined/unavailable in SOAP.",
  mass_removal_skin:
    "Skin/SQ mass removal; document location, margins, closure, and histopath submission.",
  pyometra_spay:
    "OVH for pyometra; record stability, intra-op findings, and peri-op antibiotics.",
  exploratory_laparotomy:
    "Full exploratory laparotomy; list organs inspected and any biopsies obtained.",
  enterotomy:
    "Enterotomy for foreign body/lesion; record segment, contents, closure pattern, and lavage.",
  gastrotomy:
    "Gastrotomy for foreign body; note location, contents, and leak test.",
  gastropexy:
    "Gastropexy; record technique (incisional/belt-loop/etc.) and side.",
  cystotomy:
    "Cystotomy for uroliths/mass; record stones removed and culture status.",
  feline_unblock:
    "Feline urethral obstruction; document catheterization details and post-obstructive care.",
  other_custom:
    "Custom surgery; write key findings and closure details in Procedure notes.",
};

function updateSurgeryDescription() {
  if (!surgeryTemplate || !surgeryTemplateDescription) return;
  const key = surgeryTemplate.value;
  const desc =
    surgeryTemplateDescriptions[key] ||
    surgeryTemplateDescriptions.canine_neuter_clinic;
  surgeryTemplateDescription.textContent = desc;
}

if (surgeryTemplate) {
  surgeryTemplate.addEventListener("change", updateSurgeryDescription);
  updateSurgeryDescription();
}

// Fluids declined -> disable rate box
if (fluidsDeclined && fluidRate) {
  fluidsDeclined.addEventListener("change", () => {
    if (fluidsDeclined.checked) {
      fluidRate.value = "";
      fluidRate.disabled = true;
    } else {
      fluidRate.disabled = false;
    }
  });
}

// ====== Appointment SOAP generation ======
if (generateAppointmentBtn) {
  generateAppointmentBtn.addEventListener("click", async () => {
    setStatus("Generating appointment SOAP…");

    const payload = {
      soapType: "appointment",
      strictMode: isStrictMode(),
      uiMode: getUiMode(),
      caseLabel: getCaseLabel(),
      reason: appointmentReason.value,
      tpr: appointmentTpr.value,
      history: appointmentHistory.value,
      physicalExam: appointmentPe.value,
      diagnostics: appointmentDiagnostics.value,
      assessment: appointmentAssessment.value,
      plan: appointmentPlan.value,
      medsDispensed: appointmentMeds.value,
      attachments: getFileNames(appointmentAttachments),
    };

    try {
      const text = await callBackend("soap", payload);
      fillSoapOutputsFromText(text);
      setStatus("Appointment SOAP ready.");
    } catch (err) {
      console.error(err);
      setStatus(`Error generating appointment SOAP: ${err.message}`);
    }
  });
}

// ====== Surgery SOAP generation ======
if (generateSurgeryBtn) {
  generateSurgeryBtn.addEventListener("click", async () => {
    setStatus("Generating surgery SOAP…");

    const payload = {
      soapType: "surgery",
      strictMode: isStrictMode(),
      uiMode: getUiMode(),
      caseLabel: getCaseLabel(),
      surgeryTemplate: surgeryTemplate.value,
      asaStatus: asaStatus.value,
      ivCatheter: ivCatheter.value,
      etTube: etTube.value,
      fluidRate: fluidsDeclined.checked ? "" : fluidRate.value,
      fluidsDeclined: fluidsDeclined.checked,
      premedications: premedications.value,
      induction: induction.value,
      intraopMeds: intraopMeds.value,
      procedureNotes: procedureNotes.value,
      tprNotes: tprNotes.value,
      durationNotes: durationNotes.value,
      monocrylOverrides: {
        monocryl0: monocryl0.checked,
        monocryl2_0: monocryl2_0.checked,
        monocryl3_0: monocryl3_0.checked,
      },
      attachments: getFileNames(surgeryAttachments),
    };

    try {
      const text = await callBackend("soap", payload);
      fillSoapOutputsFromText(text);
      setStatus("Surgery SOAP ready.");
    } catch (err) {
      console.error(err);
      setStatus(`Error generating surgery SOAP: ${err.message}`);
    }
  });
}

// ====== Consult generator ======
if (runConsultBtn) {
  runConsultBtn.addEventListener("click", async () => {
    setStatus("Running consult…");

    const payload = {
      message: consultInput.value,
      caseLabel: getCaseLabel(),
      uiMode: getUiMode(),
      attachments: getFileNames(consultAttachments),
    };

    try {
      const text = await callBackend("consult", payload);
      consultOutput.value = text;
      setStatus("Consult output ready.");
    } catch (err) {
      console.error(err);
      setStatus(`Error running consult: ${err.message}`);
    }
  });
}

// ====== Toolbox Lite – Bloodwork Helper ======
if (runBloodworkHelperBtn) {
  runBloodworkHelperBtn.addEventListener("click", async () => {
    setStatus("Running Bloodwork Helper Lite…");

    const payload = {
      text: toolboxLabText.value,
      detailLevel: toolboxDetailLevel.value,
      includeDiffs: toolboxIncludeDifferentials.checked,
      includeClientFriendly: toolboxClientSummary.checked,
      caseLabel: getCaseLabel(),
      attachments: getFileNames(toolboxAttachments),
    };

    try {
      const text = await callBackend("toolbox-bloodwork", payload);
      toolboxBloodworkOutput.value = text;
      setStatus("Bloodwork Helper output ready.");
    } catch (err) {
      console.error(err);
      setStatus(`Error running Bloodwork Helper: ${err.message}`);
    }
  });
}

// ====== Copy handlers ======
if (copySubjectiveBtn) {
  copySubjectiveBtn.addEventListener("click", () =>
    handleCopy(subjectiveOutput.value)
  );
}
if (copyObjectiveBtn) {
  copyObjectiveBtn.addEventListener("click", () =>
    handleCopy(objectiveOutput.value)
  );
}
if (copyAssessmentBtn) {
  copyAssessmentBtn.addEventListener("click", () =>
    handleCopy(assessmentOutput.value)
  );
}
if (copyPlanBtn) {
  copyPlanBtn.addEventListener("click", () =>
    handleCopy(planOutput.value)
  );
}
if (copyMedsBtn) {
  copyMedsBtn.addEventListener("click", () =>
    handleCopy(medsOutput.value)
  );
}
if (copyAftercareBtn) {
  copyAftercareBtn.addEventListener("click", () =>
    handleCopy(aftercareOutput.value)
  );
}

if (copyFullSoapBtn) {
  copyFullSoapBtn.addEventListener("click", () => {
    const text = [
      "Subjective:",
      subjectiveOutput.value,
      "",
      "Objective:",
      objectiveOutput.value,
      "",
      "Assessment:",
      assessmentOutput.value,
      "",
      "Plan:",
      planOutput.value,
      "",
      "Medications Dispensed:",
      medsOutput.value,
      "",
      "Aftercare:",
      aftercareOutput.value,
    ].join("\n");
    handleCopy(text);
  });
}

if (copyPlanMedsAftercareBtn) {
  copyPlanMedsAftercareBtn.addEventListener("click", () => {
    const text = [
      "Plan:",
      planOutput.value,
      "",
      "Medications Dispensed:",
      medsOutput.value,
      "",
      "Aftercare:",
      aftercareOutput.value,
    ].join("\n");
    handleCopy(text);
  });
}

// ====== Mic / speech-to-text ======
function initMic() {
  if (!micButton) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micButton.style.display = "none";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  let listening = false;

  micButton.addEventListener("click", () => {
    if (!listening) {
      try {
        recognition.start();
        listening = true;
        micButton.classList.add("listening");
      } catch (err) {
        console.error("Speech start error", err);
      }
    } else {
      recognition.stop();
      listening = false;
      micButton.classList.remove("listening");
    }
  });

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((r) => r[0].transcript)
      .join(" ");

    const target =
      lastFocusedEditable ||
      appointmentHistory ||
      consultInput ||
      toolboxLabText;

    if (target) {
      const current = target.value || "";
      target.value = current ? current + " " + transcript : transcript;
    }
  });

  recognition.addEventListener("end", () => {
    listening = false;
    micButton.classList.remove("listening");
  });
}

// Track focus so mic knows where to type
function initFocusTracking() {
  const selectors = "textarea, input[type='text']";
  document.querySelectorAll(selectors).forEach((el) => {
    el.addEventListener("focus", () => {
      lastFocusedEditable = el;
    });
  });
}

// ====== Init ======
document.addEventListener("DOMContentLoaded", () => {
  initQr();
  initMic();
  initFocusTracking();
  setStatus("Ready.");
});