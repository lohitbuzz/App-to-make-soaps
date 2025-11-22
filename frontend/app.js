// ===== CONFIG =====
const API_BASE_URL = "https://lohit-soap-app.onrender.com"; // Render backend URL

// ===== DOM HELPERS =====
function $(id) {
  return document.getElementById(id);
}

// ===== STATE =====
let activeTab = "soap";
let visitType = "appointment"; // 'appointment' | 'surgery'
let surgeryMode = "simple"; // 'simple' | 'advanced'
let relayId = "";
let recognition = null;
let isRecording = false;
let activeRecordingTextarea = null;

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupVisitAndModeToggles();
  setupForms();
  setupRelay();
  setupBackendHealth();
  setupRecorder();
});

// ===== TABS =====
function setupTabs() {
  const tabs = [
    { button: "tab-soap", panel: "panel-soap", key: "soap" },
    { button: "tab-toolbox", panel: "panel-toolbox", key: "toolbox" },
    { button: "tab-consult", panel: "panel-consult", key: "consult" },
  ];

  tabs.forEach(({ button, panel, key }) => {
    $(button).addEventListener("click", () => {
      activeTab = key;
      tabs.forEach(({ button: b, panel: p }) => {
        $(b).classList.toggle("tab-active", b === button);
        $(p).classList.toggle("panel-active", p === panel);
      });
    });
  });
}

// ===== VISIT / MODE TOGGLES =====
function setupVisitAndModeToggles() {
  const visitAppointmentBtn = $("visit-appointment");
  const visitSurgeryBtn = $("visit-surgery");
  const modeSimpleBtn = $("mode-simple");
  const modeAdvancedBtn = $("mode-advanced");

  visitAppointmentBtn.addEventListener("click", () => {
    visitType = "appointment";
    visitAppointmentBtn.classList.add("pill-active");
    visitSurgeryBtn.classList.remove("pill-active");
    updateVisitVisibility();
  });

  visitSurgeryBtn.addEventListener("click", () => {
    visitType = "surgery";
    visitSurgeryBtn.classList.add("pill-active");
    visitAppointmentBtn.classList.remove("pill-active");
    updateVisitVisibility();
  });

  modeSimpleBtn.addEventListener("click", () => {
    surgeryMode = "simple";
    modeSimpleBtn.classList.add("pill-active");
    modeAdvancedBtn.classList.remove("pill-active");
    updateModeVisibility();
  });

  modeAdvancedBtn.addEventListener("click", () => {
    surgeryMode = "advanced";
    modeAdvancedBtn.classList.add("pill-active");
    modeSimpleBtn.classList.remove("pill-active");
    updateModeVisibility();
  });

  updateVisitVisibility();
  updateModeVisibility();
}

function updateVisitVisibility() {
  const surgeryOnly = document.querySelectorAll(".visit-surgery-only");
  const appointmentOnly = document.querySelectorAll(".visit-appointment-only");

  const isSurgery = visitType === "surgery";

  surgeryOnly.forEach((el) => {
    el.style.display = isSurgery ? "" : "none";
  });
  appointmentOnly.forEach((el) => {
    el.style.display = !isSurgery ? "" : "none";
  });

  const label = $("soap-mode-label");
  label.textContent = "Appointment · Surgery · Voice";

  // Also adjust placeholder for SOAP output label
  const outStatusLabel = $("soap-output-status-label");
  outStatusLabel.textContent = "Ready";
}

function updateModeVisibility() {
  const simpleSection = $("surgery-brief-section");
  const advancedSection = $("surgery-advanced-section");
  const isAdvanced = surgeryMode === "advanced";

  if (simpleSection) {
    simpleSection.classList.toggle("hidden", isAdvanced);
  }
  if (advancedSection) {
    advancedSection.classList.toggle("hidden", !isAdvanced);
  }
}

// ===== FORMS & API CALLS =====
function setupForms() {
  const soapForm = $("soap-form");
  soapForm.addEventListener("submit", handleSoapSubmit);

  $("runToolbox").addEventListener("click", handleToolboxRun);
  $("runConsult").addEventListener("click", handleConsultRun);

  $("copy-soap-full").addEventListener("click", () =>
    copyToClipboard($("soap-output").value)
  );
  $("copy-plan-meds").addEventListener("click", () =>
    copyPlanMedsAftercare($("soap-output").value)
  );

  $("copyToolboxOutput").addEventListener("click", () =>
    copyToClipboard($("toolboxOutput").value)
  );

  $("copyConsultOutput").addEventListener("click", () =>
    copyToClipboard($("consultOutput").value)
  );

  $("apply-soap-feedback").addEventListener("click", handleSoapFeedback);
  $("applyToolboxFeedback").addEventListener("click", handleToolboxFeedback);
  $("applyConsultFeedback").addEventListener("click", handleConsultFeedback);

  $("send-to-desktop").addEventListener("click", handleSendToDesktop);
}

function gatherSoapPayload() {
  return {
    visitType,
    surgeryMode,
    caseLabel: $("caseLabel").value.trim(),
    patientName: $("patientName").value.trim(),
    weightKg: $("weightKg").value.trim(),
    species: $("species").value,
    sex: $("sex").value,
    asa: $("asa").value,
    tprNotes: $("tprNotes").value.trim(),
    appointmentPreset: $("appointmentPreset").value,
    surgeryPreset: $("surgeryPreset").value,
    vaccinesToday: $("vaccinesToday").checked,

    // Simple fields
    briefFluids: $("briefFluids").value.trim(),
    briefPremed: $("briefPremed").value.trim(),
    briefInduction: $("briefInduction").value.trim(),

    // Advanced fields
    ettSize: $("ettSize").value.trim(),
    ivCatheter: $("ivCatheter").value.trim(),
    advFluids: $("advFluids").value.trim(),
    premedProtocol: $("premedProtocol").value.trim(),
    inductionProtocol: $("inductionProtocol").value.trim(),
    maintenanceProtocol: $("maintenanceProtocol").value.trim(),
    intraOpMeds: $("intraOpMeds").value.trim(),
    postOpMeds: $("postOpMeds").value.trim(),

    // Narrative
    coreHistory: $("coreHistory").value.trim(),
    peDiagnostics: $("peDiagnostics").value.trim(),
    assessmentHints: $("assessmentHints").value.trim(),
    planHints: $("planHints").value.trim(),
    extraInstructions: $("extraInstructions").value.trim(),
    voiceNotes: $("voiceNotes").value.trim(),
  };
}

async function handleSoapSubmit(event) {
  event.preventDefault();
  const payload = gatherSoapPayload();
  const outArea = $("soap-output");
  setSoapStatus("Working…", "green");

  try {
    const res = await fetch(`${API_BASE_URL}/api/soap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    outArea.value = data.text || data.output || "[No text returned]";
    setSoapStatus("Ready", "green");
  } catch (err) {
    console.error("SOAP error", err);
    outArea.value = `Error calling backend: ${err.message}`;
    setSoapStatus("Backend unreachable", "red");
  }
}

async function handleToolboxRun() {
  const input = $("toolboxInput").value.trim();
  const out = $("toolboxOutput");
  if (!input) {
    out.value = "[Paste text or notes above first]";
    return;
  }
  out.value = "Working…";

  try {
    const res = await fetch(`${API_BASE_URL}/api/toolbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    out.value = data.text || data.output || "[No text returned]";
  } catch (err) {
    console.error("Toolbox error", err);
    out.value = `Error calling backend: ${err.message}`;
  }
}

async function handleConsultRun() {
  const input = $("consultInput").value.trim();
  const out = $("consultOutput");
  if (!input) {
    out.value = "[Type a consult question or context above first]";
    return;
  }
  out.value = "Working…";

  try {
    const res = await fetch(`${API_BASE_URL}/api/consult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    out.value = data.text || data.output || "[No text returned]";
  } catch (err) {
    console.error("Consult error", err);
    out.value = `Error calling backend: ${err.message}`;
  }
}

// ===== FEEDBACK (local only stubs) =====
function handleSoapFeedback() {
  const fb = $("soap-feedback").value.trim();
  if (!fb) return;
  const out = $("soap-output");
  out.value += `\n\n[Feedback noted locally: ${fb}]`;
  $("soap-feedback").value = "";
}

function handleToolboxFeedback() {
  const fb = $("toolboxFeedback").value.trim();
  if (!fb) return;
  const out = $("toolboxOutput");
  out.value += `\n\n[Feedback noted locally: ${fb}]`;
  $("toolboxFeedback").value = "";
}

function handleConsultFeedback() {
  const fb = $("consultFeedback").value.trim();
  if (!fb) return;
  const out = $("consultOutput");
  out.value += `\n\n[Feedback noted locally: ${fb}]`;
  $("consultFeedback").value = "";
}

// ===== BACKEND HEALTH =====
function setSoapStatus(text, color) {
  $("soap-output-status-label").textContent = text;
  const dot = $("soap-output-status-dot");
  dot.classList.remove("status-dot-green", "status-dot-red", "status-dot-gray");
  if (color === "green") dot.classList.add("status-dot-green");
  else if (color === "red") dot.classList.add("status-dot-red");
  else dot.classList.add("status-dot-gray");
}

function setBackendBadge(ok) {
  const dot = $("backend-status-dot");
  const label = $("backend-status-label");
  dot.classList.remove("status-dot-green", "status-dot-red", "status-dot-gray");
  if (ok) {
    dot.classList.add("status-dot-green");
    label.textContent = "Backend reachable";
  } else {
    dot.classList.add("status-dot-red");
    label.textContent = "Backend unreachable";
  }
}

function setupBackendHealth() {
  async function check() {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (!res.ok) throw new Error();
      setBackendBadge(true);
    } catch {
      setBackendBadge(false);
    }
  }
  check();
  setInterval(check, 30000);
}

// ===== CLIPBOARD HELPERS =====
async function copyToClipboard(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn("Clipboard error", err);
  }
}

function copyPlanMedsAftercare(fullText) {
  if (!fullText) return;
  const sections = ["Plan:", "Medications dispensed:", "Aftercare:"];
  let extracted = "";
  for (let i = 0; i < sections.length; i++) {
    const start = fullText.indexOf(sections[i]);
    if (start === -1) continue;
    const end =
      i + 1 < sections.length
        ? fullText.indexOf(sections[i + 1], start + sections[i].length)
        : fullText.length;
    extracted += fullText.slice(start, end).trim() + "\n\n";
  }
  copyToClipboard(extracted.trim());
}

// ===== RELAY (Phone ↔ Desktop) =====
function setupRelay() {
  const relayIdInput = $("relayIdInput");
  $("relayNewIdBtn").addEventListener("click", () => {
    relayId = generateRelayId();
    relayIdInput.value = relayId;
  });

  $("relayReceiveTextBtn").addEventListener("click", async () => {
    const id = relayIdInput.value.trim();
    if (!id) {
      alert("Enter a Relay ID first (or tap New).");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/relay/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relayId: id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.payload) {
        $("soap-output").value = data.payload;
      } else {
        alert("No text available yet for this Relay ID.");
      }
    } catch (err) {
      console.error("Relay receive error", err);
      alert("Error receiving text from backend.");
    }
  });

  $("uploadInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    alert(
      `${files.length} file(s) selected. File relay is a future version – for now, attach originals to Avimark manually.`
    );
  });
}

function generateRelayId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function handleSendToDesktop() {
  const text = $("soap-output").value.trim();
  if (!text) {
    alert("No output to send yet – generate a SOAP first.");
    return;
  }
  if (!relayId) {
    relayId = generateRelayId();
    $("relayIdInput").value = relayId;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/relay/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relayId, payload: text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    alert(`Sent to backend. Use Relay ID "${relayId}" on desktop to receive.`);
  } catch (err) {
    console.error("Relay send error", err);
    alert("Error sending text to backend.");
  }
}

// ===== RECORDER =====
function setupRecorder() {
  const recordBtn = $("record-btn");
  const textareas = document.querySelectorAll("textarea[data-allow-recording='true']");

  textareas.forEach((ta) => {
    ta.addEventListener("focus", () => {
      activeRecordingTextarea = ta;
    });
  });

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    recordBtn.textContent = "🎤 Recorder (unsupported)";
    recordBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    if (!activeRecordingTextarea) return;
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + " ";
    }
    transcript = transcript.trim();
    if (!transcript) return;

    const ta = activeRecordingTextarea;
    const prefix = ta.value && !ta.value.endsWith(" ") ? " " : "";
    ta.value += prefix + transcript;
  };

  recognition.onend = () => {
    if (isRecording) {
      // Safari sometimes stops; restart for continuous mode
      recognition.start();
    }
  };

  recordBtn.addEventListener("click", () => {
    if (!isRecording) {
      try {
        recognition.start();
        isRecording = true;
        recordBtn.classList.add("recording");
        recordBtn.textContent = "⏹ Stop recorder";
      } catch (err) {
        console.error("Recorder start error", err);
      }
    } else {
      recognition.stop();
      isRecording = false;
      recordBtn.classList.remove("recording");
      recordBtn.textContent = "🎤 Recorder";
    }
  });
}