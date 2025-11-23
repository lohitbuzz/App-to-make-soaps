// ===== Basic helpers =====

const statusEl = document.getElementById("statusMessage");
const consoleEl = document.getElementById("consoleOutput");

function logStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
  appendConsole(`[STATUS] ${msg}`);
}

function appendConsole(msg) {
  if (!consoleEl) return;
  const ts = new Date().toLocaleTimeString();
  consoleEl.value += `[${ts}] ${msg}\n`;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function handleError(context, err) {
  console.error(err);
  appendConsole(`[ERROR] ${context}: ${err?.message || err}`);
  logStatus(`Error in ${context}. Check console.`);
}

// ===== Tab navigation =====

const tabButtons = document.querySelectorAll(".tab-button");
const sections = document.querySelectorAll(".tab-section");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const targetId = btn.dataset.tab;
    sections.forEach((sec) => {
      sec.classList.toggle("hidden", sec.id !== targetId);
    });
  });
});

// ===== Surgery Simple / Advanced toggle =====

const sxModeButtons = document.querySelectorAll("[data-sx-mode]");
const sxSimpleBlock = document.getElementById("sxSimpleBlock");
const sxAdvancedBlock = document.getElementById("sxAdvancedBlock");

sxModeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.sxMode;
    sxModeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (mode === "simple") {
      sxSimpleBlock.classList.remove("hidden");
      sxAdvancedBlock.classList.add("hidden");
    } else {
      sxSimpleBlock.classList.add("hidden");
      sxAdvancedBlock.classList.remove("hidden");
    }
  });
});

// ===== Netlify endpoint base =====

const FUNCTIONS_BASE = "/.netlify/functions";

// ===== File capture helpers (we send filenames only; Netlify Vision endpoint will pull binary via multipart) =====
// For this version, we just keep File objects in memory and send count + names + roles to the backend.
// If you want true binary upload, we can switch these endpoints to FormData later.

let apptFiles = [];
let sxFiles = [];
let toolboxFiles = [];
let consultFiles = [];

document.getElementById("apptFiles")?.addEventListener("change", (e) => {
  apptFiles = Array.from(e.target.files || []);
  appendConsole(`Appointment files: ${apptFiles.map((f) => f.name).join(", ")}`);
});

document.getElementById("sxFiles")?.addEventListener("change", (e) => {
  sxFiles = Array.from(e.target.files || []);
  appendConsole(`Surgery files: ${sxFiles.map((f) => f.name).join(", ")}`);
});

document.getElementById("toolboxFiles")?.addEventListener("change", (e) => {
  toolboxFiles = Array.from(e.target.files || []);
  appendConsole(`Toolbox files: ${toolboxFiles.map((f) => f.name).join(", ")}`);
});

document.getElementById("consultFiles")?.addEventListener("change", (e) => {
  consultFiles = Array.from(e.target.files || []);
  appendConsole(`Consult files: ${consultFiles.map((f) => f.name).join(", ")}`);
});

// ===== SOAP: Appointment =====

const apptReason = document.getElementById("apptReason");
const apptHistory = document.getElementById("apptHistory");
const apptPE = document.getElementById("apptPE");
const apptDiagnostics = document.getElementById("apptDiagnostics");
const apptAssessment = document.getElementById("apptAssessment");
const apptPlan = document.getElementById("apptPlan");
const apptMeds = document.getElementById("apptMeds");

const soapOutput = document.getElementById("soapOutput");
const soapFeedbackInput = document.getElementById("soapFeedbackInput");

document.getElementById("generateApptSoapBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Generating appointment SOAP...");
    const body = {
      mode: "appointment",
      reason: apptReason.value,
      history: apptHistory.value,
      pe: apptPE.value,
      diagnostics: apptDiagnostics.value,
      assessmentHints: apptAssessment.value,
      planHints: apptPlan.value,
      medsHints: apptMeds.value,
      transcript: document.getElementById("useTranscriptForAppt")?.checked
        ? document.getElementById("recordingTranscriptAppt")?.value || ""
        : "",
      files: apptFiles.map((f) => ({ name: f.name, type: f.type })),
    };

    const res = await fetch(`${FUNCTIONS_BASE}/soap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "SOAP error");

    soapOutput.value = data.soap || "";
    appendConsole("[SOAP] Appointment SOAP generated.");
    logStatus("Appointment SOAP ready.");
  } catch (err) {
    handleError("appointment SOAP", err);
  }
});

document.getElementById("clearApptBtn")?.addEventListener("click", () => {
  [apptReason, apptHistory, apptPE, apptDiagnostics, apptAssessment, apptPlan, apptMeds].forEach(
    (el) => el && (el.value = "")
  );
  soapOutput.value = "";
  soapFeedbackInput.value = "";
});

// Refine appointment SOAP
document.getElementById("improveSoapBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Refining appointment SOAP...");
    const body = {
      mode: "soap-refine",
      originalSoap: soapOutput.value,
      feedback: soapFeedbackInput.value,
    };
    const res = await fetch(`${FUNCTIONS_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Feedback error");
    soapOutput.value = data.soap || data.text || soapOutput.value;
    appendConsole("[SOAP] Appointment SOAP refined.");
    logStatus("SOAP refined.");
  } catch (err) {
    handleError("appointment refine", err);
  }
});

// Copy SOAP
document.getElementById("copySoapBtn")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(soapOutput.value);
    logStatus("SOAP copied to clipboard.");
  } catch (err) {
    handleError("copy SOAP", err);
  }
});

// ===== SOAP transformers (email / summary / client / planOnly / rephrase) =====

document.querySelectorAll(".extra-block button[data-transform]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const transform = btn.dataset.transform;
    const targetId = btn.dataset.target;
    const srcEl = document.getElementById(targetId);
    if (!srcEl || !srcEl.value.trim()) {
      logStatus("No SOAP to transform.");
      return;
    }
    try {
      logStatus(`Generating ${transform} version...`);
      const body = {
        mode: "transform",
        transformType: transform,
        originalSoap: srcEl.value,
      };
      const res = await fetch(`${FUNCTIONS_BASE}/toolbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transform error");
      srcEl.value = data.text || srcEl.value;
      appendConsole(`[SOAP] ${transform} version generated.`);
      logStatus("Transform complete.");
    } catch (err) {
      handleError(`SOAP transform (${transform})`, err);
    }
  });
});

// ===== Surgery SOAP =====

const sxPreset = document.getElementById("sxPreset");
const sxReason = document.getElementById("sxReason");
const sxHistory = document.getElementById("sxHistory");
const sxPE = document.getElementById("sxPE");
const sxDiagnostics = document.getElementById("sxDiagnostics");

const sxReasonAdv = document.getElementById("sxReasonAdv");
const sxHistoryAdv = document.getElementById("sxHistoryAdv");
const sxPEAdv = document.getElementById("sxPEAdv");
const sxDiagnosticsAdv = document.getElementById("sxDiagnosticsAdv");

const premedSelect = document.getElementById("premedSelect");
const inductionSelect = document.getElementById("inductionSelect");
const sxFluids = document.getElementById("sxFluids");
const sxTubeIV = document.getElementById("sxTubeIV");
const intraOpMeds = document.getElementById("intraOpMeds");
const postOpMeds = document.getElementById("postOpMeds");
const sxProcedureNotes = document.getElementById("sxProcedureNotes");
const sxRecovery = document.getElementById("sxRecovery");
const sxMedsDispensed = document.getElementById("sxMedsDispensed");

const sxSoapOutput = document.getElementById("soapOutputSx");
const sxFeedbackInput = document.getElementById("sxFeedbackInput");

document.getElementById("generateSxSoapBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Generating surgery SOAP...");

    // determine active mode
    const activeModeBtn = document.querySelector(".mode-btn.active");
    const mode = activeModeBtn?.dataset.sxMode || "simple";

    const baseFields =
      mode === "simple"
        ? {
            sxMode: "simple",
            preset: sxPreset.value,
            reason: sxReason.value,
            history: sxHistory.value,
            pe: sxPE.value,
            diagnostics: sxDiagnostics.value,
          }
        : {
            sxMode: "advanced",
            preset: sxPreset.value || "",
            reason: sxReasonAdv.value,
            history: sxHistoryAdv.value,
            pe: sxPEAdv.value,
            diagnostics: sxDiagnosticsAdv.value,
            premed: premedSelect.value,
            induction: inductionSelect.value,
            fluids: sxFluids.value,
            tubeIV: sxTubeIV.value,
            intraOpMeds: intraOpMeds.value,
            postOpMeds: postOpMeds.value,
            procedureNotes: sxProcedureNotes.value,
            recovery: sxRecovery.value,
            medsDispensed: sxMedsDispensed.value,
          };

    const body = {
      mode: "surgery",
      ...baseFields,
      transcript: document.getElementById("useTranscriptForSx")?.checked
        ? document.getElementById("recordingTranscriptSx")?.value || ""
        : "",
      files: sxFiles.map((f) => ({ name: f.name, type: f.type })),
    };

    const res = await fetch(`${FUNCTIONS_BASE}/soap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Surgery SOAP error");

    sxSoapOutput.value = data.soap || "";
    appendConsole("[SOAP] Surgery SOAP generated.");
    logStatus("Surgery SOAP ready.");
  } catch (err) {
    handleError("surgery SOAP", err);
  }
});

document.getElementById("clearSxBtn")?.addEventListener("click", () => {
  [sxReason, sxHistory, sxPE, sxDiagnostics, sxReasonAdv, sxHistoryAdv, sxPEAdv, sxDiagnosticsAdv].forEach(
    (el) => el && (el.value = "")
  );
  [sxFluids, sxTubeIV].forEach((el) => el && (el.value = ""));
  [intraOpMeds, postOpMeds, sxProcedureNotes, sxRecovery, sxMedsDispensed].forEach(
    (el) => el && (el.value = "")
  );
  sxSoapOutput.value = "";
  sxFeedbackInput.value = "";
});

// Refine surgery SOAP
document.getElementById("sxImproveBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Refining surgery SOAP...");
    const body = {
      mode: "soap-refine",
      originalSoap: sxSoapOutput.value,
      feedback: sxFeedbackInput.value,
    };
    const res = await fetch(`${FUNCTIONS_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Feedback error");
    sxSoapOutput.value = data.soap || data.text || sxSoapOutput.value;
    appendConsole("[SOAP] Surgery SOAP refined.");
    logStatus("Surgery SOAP refined.");
  } catch (err) {
    handleError("surgery refine", err);
  }
});

// ===== Toolbox =====

const toolboxMode = document.getElementById("toolboxMode");
const toolboxInput = document.getElementById("toolboxInput");
const toolboxOutput = document.getElementById("toolboxOutput");
const toolboxFeedbackInput = document.getElementById("toolboxFeedbackInput");

document.getElementById("toolboxGenerateBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Running Toolbox...");
    const body = {
      mode: "toolbox-main",
      toolboxMode: toolboxMode.value,
      text: toolboxInput.value,
      files: toolboxFiles.map((f) => ({ name: f.name, type: f.type })),
    };
    const res = await fetch(`${FUNCTIONS_BASE}/toolbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Toolbox error");
    toolboxOutput.value = data.text || "";
    appendConsole(`[TOOLBOX] Mode ${toolboxMode.value} complete.`);
    logStatus("Toolbox output ready.");
  } catch (err) {
    handleError("toolbox", err);
  }
});

document.getElementById("toolboxRefineBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Refining toolbox output...");
    const body = {
      mode: "toolbox-refine",
      original: toolboxOutput.value,
      feedback: toolboxFeedbackInput.value,
      toolboxMode: toolboxMode.value,
    };
    const res = await fetch(`${FUNCTIONS_BASE}/toolbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Refine error");
    toolboxOutput.value = data.text || toolboxOutput.value;
    appendConsole("[TOOLBOX] Refined.");
    logStatus("Toolbox refined.");
  } catch (err) {
    handleError("toolbox refine", err);
  }
});

document.getElementById("toolboxClearBtn")?.addEventListener("click", () => {
  toolboxInput.value = "";
  toolboxOutput.value = "";
  toolboxFeedbackInput.value = "";
});

// ===== Consult =====

const consultMessage = document.getElementById("consultMessage");
const consultOutput = document.getElementById("consultOutput");
const consultFeedbackInput = document.getElementById("consultFeedbackInput");

document.getElementById("consultAskBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Sending consult...");
    const body = {
      question: consultMessage.value,
      files: consultFiles.map((f) => ({ name: f.name, type: f.type })),
    };
    const res = await fetch(`${FUNCTIONS_BASE}/consult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Consult error");
    consultOutput.value = data.text || "";
    appendConsole("[CONSULT] Answer returned.");
    logStatus("Consult answer ready.");
  } catch (err) {
    handleError("consult", err);
  }
});

document.getElementById("consultRefineBtn")?.addEventListener("click", async () => {
  try {
    logStatus("Refining consult...");
    const body = {
      mode: "consult-refine",
      original: consultOutput.value,
      feedback: consultFeedbackInput.value,
    };
    const res = await fetch(`${FUNCTIONS_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Consult refine error");
    consultOutput.value = data.text || consultOutput.value;
    appendConsole("[CONSULT] Refined.");
    logStatus("Consult refined.");
  } catch (err) {
    handleError("consult refine", err);
  }
});

document.getElementById("consultClearBtn")?.addEventListener("click", () => {
  consultMessage.value = "";
  consultOutput.value = "";
  consultFeedbackInput.value = "";
});

// ===== Voice Recorder (Web Speech API, front-end only) =====

function setupRecorder(startBtnId, transcriptId) {
  const startBtn = document.getElementById(startBtnId);
  const transcriptEl = document.getElementById(transcriptId);
  if (!startBtn || !transcriptEl) return;

  let recognition = null;
  let isRecording = false;

  const SpeechRec =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!SpeechRec) {
    startBtn.disabled = true;
    appendConsole("[REC] Web Speech API not available in this browser.");
    return;
  }

  recognition = new SpeechRec();
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let text = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
    }
    transcriptEl.value = text;
  };

  recognition.onerror = (e) => {
    appendConsole(`[REC] Error: ${e.error}`);
    isRecording = false;
    startBtn.textContent = "● Record";
  };

  recognition.onend = () => {
    if (isRecording) {
      recognition.start();
    } else {
      startBtn.textContent = "● Record";
    }
  };

  startBtn.addEventListener("click", () => {
    if (!recognition) return;
    if (!isRecording) {
      recognition.start();
      isRecording = true;
      startBtn.textContent = "■ Stop";
      appendConsole("[REC] Recording started.");
    } else {
      recognition.stop();
      isRecording = false;
      startBtn.textContent = "● Record";
      appendConsole("[REC] Recording stopped.");
    }
  });
}

setupRecorder("startRecordApptBtn", "recordingTranscriptAppt");
setupRecorder("startRecordBtnSx", "recordingTranscriptSx");

// send transcript to backend = just log via feedback function for now
document.getElementById("sendAudioBackendApptBtn")?.addEventListener("click", async () => {
  try {
    const text = document.getElementById("recordingTranscriptAppt").value;
    const res = await fetch(`${FUNCTIONS_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "voice", transcript: text, context: "appointment" }),
    });
    await res.json();
    appendConsole("[REC] Appointment transcript sent to backend.");
  } catch (err) {
    handleError("sendAudioBackendAppt", err);
  }
});

document.getElementById("sendAudioTextboxApptBtn")?.addEventListener("click", () => {
  const text = document.getElementById("recordingTranscriptAppt").value;
  apptHistory.value = (apptHistory.value + "\n" + text).trim();
  appendConsole("[REC] Transcript added to appointment history.");
});

document.getElementById("sendAudioBackendBtnSx")?.addEventListener("click", async () => {
  try {
    const text = document.getElementById("recordingTranscriptSx").value;
    const res = await fetch(`${FUNCTIONS_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "voice", transcript: text, context: "surgery" }),
    });
    await res.json();
    appendConsole("[REC] Surgery transcript sent to backend.");
  } catch (err) {
    handleError("sendAudioBackendSx", err);
  }
});

document.getElementById("sendAudioTextboxBtnSx")?.addEventListener("click", () => {
  const text = document.getElementById("recordingTranscriptSx").value;
  const activeModeBtn = document.querySelector(".mode-btn.active");
  const mode = activeModeBtn?.dataset.sxMode || "simple";
  if (mode === "simple") {
    sxHistory.value = (sxHistory.value + "\n" + text).trim();
  } else {
    sxHistoryAdv.value = (sxHistoryAdv.value + "\n" + text).trim();
  }
  appendConsole("[REC] Transcript added to surgery history.");
});

// ===== Basic Privacy Modal (Rectangle redaction stub) =====

const privacyModal = document.getElementById("privacyModal");
const privacyCanvas = document.getElementById("privacyCanvas");
const closePrivacyModal = document.getElementById("closePrivacyModal");
const addRectBtn = document.getElementById("addRectBtn");
const resetRectsBtn = document.getElementById("resetRectsBtn");
const applyPrivacyBtn = document.getElementById("applyPrivacyBtn");
const privacyBadge = document.getElementById("privacyBadge");

let currentPrivacyImage = null;
let rects = [];
let draggingRectIndex = -1;
let dragOffsetX = 0;
let dragOffsetY = 0;

function openPrivacyEditorFor(filesArray) {
  if (!filesArray || filesArray.length === 0) {
    logStatus("No file selected for privacy editing.");
    return;
  }
  // For now we just show a placeholder black canvas; full image pipeline can be added later.
  currentPrivacyImage = null;
  rects = [];
  const ctx = privacyCanvas.getContext("2d");
  const width = 500;
  const height = 300;
  privacyCanvas.width = width;
  privacyCanvas.height = height;
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, width, height);

  drawRects();
  privacyModal.classList.remove("hidden");
}

function drawRects() {
  const ctx = privacyCanvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, privacyCanvas.width, privacyCanvas.height);

  // Draw redaction rectangles
  ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
  rects.forEach((r) => ctx.fillRect(r.x, r.y, r.w, r.h));
  ctx.strokeStyle = "#f87171";
  ctx.lineWidth = 2;
  rects.forEach((r) => ctx.strokeRect(r.x, r.y, r.w, r.h));
}

function hitTestRect(x, y) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return i;
    }
  }
  return -1;
}

privacyCanvas?.addEventListener("mousedown", (e) => {
  const rect = privacyCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const idx = hitTestRect(x, y);
  if (idx >= 0) {
    draggingRectIndex = idx;
    dragOffsetX = x - rects[idx].x;
    dragOffsetY = y - rects[idx].y;
  }
});

privacyCanvas?.addEventListener("mousemove", (e) => {
  if (draggingRectIndex < 0) return;
  const rect = privacyCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  rects[draggingRectIndex].x = x - dragOffsetX;
  rects[draggingRectIndex].y = y - dragOffsetY;
  drawRects();
});

["mouseup", "mouseleave"].forEach((ev) =>
  privacyCanvas?.addEventListener(ev, () => {
    draggingRectIndex = -1;
  })
);

addRectBtn?.addEventListener("click", () => {
  rects.push({ x: 50, y: 50, w: 120, h: 60 });
  drawRects();
});

resetRectsBtn?.addEventListener("click", () => {
  rects = [];
  drawRects();
});

applyPrivacyBtn?.addEventListener("click", () => {
  privacyModal.classList.add("hidden");
  if (privacyBadge) {
    privacyBadge.textContent = "Clinic-safe (rectangles applied)";
  }
  appendConsole(`[PRIVACY] Rectangles: ${rects.length} (visual only in this version).`);
});

closePrivacyModal?.addEventListener("click", () => {
  privacyModal.classList.add("hidden");
});

// open privacy editor for each section
document.getElementById("apptPrivacyEditBtn")?.addEventListener("click", () =>
  openPrivacyEditorFor(apptFiles)
);
document.getElementById("sxPrivacyEditBtn")?.addEventListener("click", () =>
  openPrivacyEditorFor(sxFiles)
);
document.getElementById("toolboxPrivacyEditBtn")?.addEventListener("click", () =>
  openPrivacyEditorFor(toolboxFiles)
);
document.getElementById("consultPrivacyEditBtn")?.addEventListener("click", () =>
  openPrivacyEditorFor(consultFiles)
);

// ===== Phone → Desktop basic QR (client-only, best-effort) =====

// Very lightweight: we just generate a QR using a public API pointing to the same URL with a session ID.
// Actual cross-device syncing still requires a backing store, so this is mostly for deep-linking right now.

const generateRelayQRBtn = document.getElementById("generateRelayQR");
const relayQR = document.getElementById("relayQR");
const relayOutput = document.getElementById("relayOutput");

generateRelayQRBtn?.addEventListener("click", () => {
  const sessionId = Math.random().toString(36).slice(2, 8);
  const url = `${window.location.origin}/?relay=${sessionId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    url
  )}`;
  relayQR.src = qrUrl;
  appendConsole(`[RELAY] Session QR generated: ${url}`);
  relayOutput.value = `Session ID: ${sessionId}\nScan on your phone and paste content there. (Basic, no live sync yet.)`;
});

// Clear console
document.getElementById("clearConsoleBtn")?.addEventListener("click", () => {
  consoleEl.value = "";
});