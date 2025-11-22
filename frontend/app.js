// ---------- CONFIG & HELPERS ----------

const isNetlify = window.location.hostname.endsWith("netlify.app");
const BRAIN_ENDPOINT = isNetlify
  ? "/.netlify/functions/brain"
  : "/api/brain";

function $(id) {
  return document.getElementById(id);
}

function showModal(message) {
  const modal = $("modal");
  const msg = $("modalMessage");
  msg.textContent = message;
  modal.classList.remove("hidden");
}

function hideModal() {
  $("modal").classList.add("hidden");
}

// Copy helper
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showModal("Copied to clipboard.");
  } catch (e) {
    console.error(e);
    showModal("Could not copy automatically. Please select and copy manually.");
  }
}

// ---------- BACKEND STATUS ----------

async function checkBackendReachable() {
  const pill = $("backendStatusPill");
  const text = $("backendStatusText");
  try {
    const res = await fetch(BRAIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "ping" })
    });
    if (!res.ok) throw new Error("Non-200");
    pill.classList.remove("status-pill--unknown", "status-pill--error");
    pill.classList.add("status-pill--ready");
    text.textContent = "Backend reachable";
  } catch (err) {
    console.warn("Backend unreachable", err);
    pill.classList.remove("status-pill--unknown", "status-pill--ready");
    pill.classList.add("status-pill--error");
    text.textContent = "Backend unreachable";
  }
}

// ---------- TABS ----------

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const contents = {
    soap: $("tab-soap"),
    toolbox: $("tab-toolbox"),
    consult: $("tab-consult")
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      buttons.forEach((b) => b.classList.remove("tab-button--active"));
      btn.classList.add("tab-button--active");
      Object.values(contents).forEach((el) =>
        el.classList.remove("tab-content--active")
      );
      contents[tab].classList.add("tab-content--active");
    });
  });
}

// ---------- VISIT TYPE & SURGERY MODE ----------

let visitType = "appointment"; // "appointment" | "surgery"
let surgeryMode = "simple"; // "simple" | "advanced"

function refreshSurgeryBlocks() {
  const simpleBlock = $("simpleSurgeryBlock");
  const advBlock = $("advancedAnesthesiaBlock");

  const isSurgery = visitType === "surgery";
  const isSimple = surgeryMode === "simple";
  const isAdvanced = visitType === "surgery" && surgeryMode === "advanced";

  simpleBlock.style.display = isSurgery && isSimple ? "block" : "none";
  advBlock.style.display = isAdvanced ? "block" : "none";
}

function setupVisitControls() {
  const visitAppointment = $("visitAppointment");
  const visitSurgery = $("visitSurgery");
  const modeSimple = $("modeSimple");
  const modeAdvanced = $("modeAdvanced");

  visitAppointment.addEventListener("click", () => {
    visitType = "appointment";
    visitAppointment.classList.add("segmented-btn--active");
    visitSurgery.classList.remove("segmented-btn--active");
    refreshSurgeryBlocks();
  });

  visitSurgery.addEventListener("click", () => {
    visitType = "surgery";
    visitSurgery.classList.add("segmented-btn--active");
    visitAppointment.classList.remove("segmented-btn--active");
    refreshSurgeryBlocks();
  });

  modeSimple.addEventListener("click", () => {
    surgeryMode = "simple";
    modeSimple.classList.add("segmented-btn--active");
    modeAdvanced.classList.remove("segmented-btn--active");
    refreshSurgeryBlocks();
  });

  modeAdvanced.addEventListener("click", () => {
    surgeryMode = "advanced";
    modeAdvanced.classList.add("segmented-btn--active");
    modeSimple.classList.remove("segmented-btn--active");
    refreshSurgeryBlocks();
  });

  refreshSurgeryBlocks();
}

// ---------- VISION ATTACHMENTS ----------

let visionFilesMeta = [];

function setupVisionAttachments() {
  const input = $("visionFiles");
  const summary = $("visionFilesSummary");

  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    visionFilesMeta = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type
      // NOTE: we are NOT sending/reading file data yet – privacy-first stub.
    }));

    if (!files.length) {
      summary.textContent = "No files selected.";
      return;
    }

    const names = files.map((f) => f.name).join(", ");
    summary.textContent = `${files.length} file(s): ${names}`;

    // Gentle reminder about current behaviour
    showModal(
      `${files.length} file(s) selected. Vision is wired in the backend, but file relay is still a privacy-first stub.\n\nFor now, use these as mental context and attach originals to Avimark manually.`
    );
  });
}

// ---------- RELAY FILE UPLOAD ----------

function setupRelayUpload() {
  const input = $("relayFileInput");
  const note = $("relayFilesNote");

  input.addEventListener("change", () => {
    const count = input.files ? input.files.length : 0;
    if (!count) {
      note.textContent =
        "No files uploaded yet. Use “Send output to desktop” from your phone, then “Receive text” here.";
      return;
    }
    note.textContent = `${count} file(s) selected. File relay is a future version – for now, attach originals to Avimark manually.`;
    showModal(
      `${count} file(s) selected. File relay is a future version – for now, attach originals to Avimark manually.`
    );
  });

  $("btnNewRelayId").addEventListener("click", () => {
    const id = `R-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    $("relayId").value = id;
  });

  $("btnReceiveTextFromPhone").addEventListener("click", () => {
    showModal(
      "Phone → desktop text relay will use the Relay ID in a future version.\n\nFor now, copy on phone and paste into this app on desktop."
    );
  });
}

// ---------- VOICE RECORDER ----------

let recognition = null;
let isRecording = false;
let lastTranscript = "";
let recorderTaggedForBackend = "";

function setupRecorder() {
  const status = $("recorderStatus");
  const btnToggle = $("btnToggleRecord");
  const btnToField = $("btnRecorderToField");
  const btnToBackend = $("btnRecorderToBackend");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    status.textContent =
      "Recorder not supported in this browser. Use your keyboard mic and paste into the voice notes box.";
    btnToggle.disabled = true;
    btnToField.disabled = true;
    btnToBackend.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    lastTranscript = transcript.trim();
    status.textContent = `Listening… transcript: “${lastTranscript.slice(
      0,
      120
    )}${lastTranscript.length > 120 ? "…" : ""}”`;
  };

  recognition.onerror = (event) => {
    console.error("SpeechRecognition error", event);
    status.textContent = "Recorder error – try again or use keyboard.";
    isRecording = false;
    btnToggle.textContent = "Start recording";
  };

  recognition.onend = () => {
    if (isRecording) return; // we stopped manually
    status.textContent = "Recorder stopped.";
    isRecording = false;
    btnToggle.textContent = "Start recording";
  };

  btnToggle.addEventListener("click", () => {
    if (!recognition) return;
    if (!isRecording) {
      try {
        recognition.start();
        isRecording = true;
        status.textContent = "Listening… speak your notes.";
        btnToggle.textContent = "Stop recording";
      } catch (err) {
        console.error(err);
      }
    } else {
      recognition.stop();
      isRecording = false;
      btnToggle.textContent = "Start recording";
      status.textContent =
        lastTranscript || "Recorder stopped – no transcript captured.";
    }
  });

  btnToField.addEventListener("click", () => {
    const target = $("recorderTarget").value;
    if (!lastTranscript) {
      showModal("No transcript captured yet.");
      return;
    }
    if (target === "soap-voice") {
      $("voiceNotes").value = ($("voiceNotes").value + " " + lastTranscript).trim();
    } else if (target === "toolbox") {
      $("toolboxInput").value = (
        $("toolboxInput").value +
        " " +
        lastTranscript
      ).trim();
    } else if (target === "consult") {
      $("consultInput").value = (
        $("consultInput").value +
        " " +
        lastTranscript
      ).trim();
    }
    showModal("Transcript inserted into selected textbox.");
  });

  btnToBackend.addEventListener("click", () => {
    if (!lastTranscript) {
      showModal("No transcript captured yet.");
      return;
    }
    recorderTaggedForBackend = lastTranscript;
    status.textContent =
      "Transcript tagged for backend use on the next Generate / Run.";
    showModal("Transcript will be sent to the backend with your next request.");
  });
}

// ---------- PAYLOAD BUILDERS ----------

function collectCommonContext() {
  return {
    caseLabel: $("caseLabel").value,
    patientName: $("patientName").value,
    weightKg: $("weightKg").value,
    species: $("species").value,
    sex: $("sex").value,
    asa: $("asa").value,
    tprNotes: $("tprNotes").value,
    surgeryPreset: $("surgeryPreset").value,
    vaccinesDone: $("vaccinesDone").checked,
    visionFiles: visionFilesMeta,
    recorderTranscript: recorderTaggedForBackend || $("voiceNotes").value
  };
}

function buildSoapPayload() {
  const common = collectCommonContext();

  const simple = {
    simpleFluids: $("simpleFluids").value,
    simplePremed: $("simplePremed").value,
    simpleInduction: $("simpleInduction").value
  };

  const advanced = {
    etTube: $("etTube").value,
    ivCatheter: $("ivCatheter").value,
    advFluids: $("advFluids").value,
    premedProtocol: $("premedProtocol").value,
    induction: $("induction").value,
    maintenance: $("maintenance").value,
    intraOpMeds: $("intraOpMeds").value,
    postOpMeds: $("postOpMeds").value
  };

  return {
    mode: "soap",
    visitType,
    surgeryMode,
    common,
    simple,
    advanced,
    subjective: $("coreNotes").value,
    objective: $("peDiagnostics").value,
    assessmentHints: $("assessmentHints").value,
    planHints: $("planHints").value,
    extraInstructions: $("extraInstructions").value
  };
}

function buildToolboxPayload(kind) {
  return {
    mode: "toolbox",
    toolboxKind: kind,
    text: $("toolboxInput").value,
    visionFiles: visionFilesMeta,
    recorderTranscript: recorderTaggedForBackend
  };
}

function buildConsultPayload() {
  return {
    mode: "consult",
    text: $("consultInput").value,
    visionFiles: visionFilesMeta,
    recorderTranscript: recorderTaggedForBackend
  };
}

// ---------- BACKEND CALL ----------

async function callBrain(payload, options = {}) {
  const mainStatusPill = $("mainOutputStatusPill");
  const mainStatusText = $("mainOutputStatusText");

  const originalLabel = mainStatusText.textContent;
  mainStatusPill.classList.remove("status-pill--ready", "status-pill--error");
  mainStatusPill.classList.add("status-pill--unknown");
  mainStatusText.textContent = "Thinking…";

  try {
    const res = await fetch(BRAIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const main = $("mainOutput");
    // Expecting { mainText, toolboxText, consultText } shape; fallbacks safe.
    if (options.target === "toolbox") {
      $("toolboxOutput").value = data.toolboxText || data.mainText || "";
      main.value = data.mainText || data.toolboxText || main.value;
    } else if (options.target === "consult") {
      $("consultOutput").value = data.consultText || data.mainText || "";
      main.value = data.mainText || data.consultText || main.value;
    } else {
      main.value = data.mainText || data.soapText || "";
    }

    mainStatusPill.classList.remove("status-pill--unknown", "status-pill--error");
    mainStatusPill.classList.add("status-pill--ready");
    mainStatusText.textContent = "Ready";

    // After a successful call, clear the tagged transcript so you don't double-send.
    recorderTaggedForBackend = "";
  } catch (err) {
    console.error("Brain call failed", err);
    mainStatusPill.classList.remove("status-pill--unknown", "status-pill--ready");
    mainStatusPill.classList.add("status-pill--error");
    mainStatusText.textContent = "Error";
    showModal(
      "Could not reach the Moksha SOAP backend. Check if the Netlify function / Render server is running."
    );
  } finally {
    if (mainStatusPill.classList.contains("status-pill--unknown")) {
      mainStatusText.textContent = originalLabel;
    }
  }
}

// ---------- BUTTON WIRING ----------

function setupButtons() {
  // SOAP
  $("btnGenerateSoap").addEventListener("click", () => {
    const payload = buildSoapPayload();
    callBrain(payload, { target: "soap" });
  });

  // Toolbox
  $("btnRunToolbox").addEventListener("click", () => {
    const mode = $("toolboxMode").value || "auto";
    const payload = buildToolboxPayload(mode);
    callBrain(payload, { target: "toolbox" });
  });

  $("btnRefineToolbox").addEventListener("click", () => {
    const feedback = $("toolboxFeedback").value;
    if (!feedback.trim()) {
      showModal("Add a brief note about what to change first.");
      return;
    }
    const payload = {
      mode: "toolbox-refine",
      feedback,
      lastOutput: $("toolboxOutput").value
    };
    callBrain(payload, { target: "toolbox" });
  });

  $("btnCopyToolboxOutput").addEventListener("click", () =>
    copyToClipboard($("toolboxOutput").value)
  );

  // Consult
  $("btnRunConsult").addEventListener("click", () => {
    const payload = buildConsultPayload();
    callBrain(payload, { target: "consult" });
  });

  $("btnRefineConsult").addEventListener("click", () => {
    const feedback = $("consultFeedback").value;
    if (!feedback.trim()) {
      showModal("Add a brief note about what to change first.");
      return;
    }
    const payload = {
      mode: "consult-refine",
      feedback,
      lastOutput: $("consultOutput").value
    };
    callBrain(payload, { target: "consult" });
  });

  $("btnCopyConsultOutput").addEventListener("click", () =>
    copyToClipboard($("consultOutput").value)
  );

  // Shared output copy buttons
  $("btnCopyFull").addEventListener("click", () =>
    copyToClipboard($("mainOutput").value)
  );

  $("btnCopyPlanMedsAftercare").addEventListener("click", () => {
    // Simple heuristic: find "Plan:" onward.
    const text = $("mainOutput").value;
    const idx = text.toLowerCase().indexOf("plan:");
    const slice = idx >= 0 ? text.slice(idx) : text;
    copyToClipboard(slice);
  });

  $("btnSendOutputToDesktop").addEventListener("click", () => {
    showModal(
      "In the current version, 'Send output to desktop' is a reminder to copy this text into your desktop browser.\n\nLater, this will pair with Relay ID for real-time phone → desktop paste."
    );
  });

  // Feedback on main output
  $("btnApplyFeedback").addEventListener("click", () => {
    const feedback = $("mainFeedback").value;
    if (!feedback.trim()) {
      showModal("Add a brief note about what to change first.");
      return;
    }
    const payload = {
      mode: "soap-refine",
      feedback,
      lastOutput: $("mainOutput").value
    };
    callBrain(payload, { target: "soap" });
  });

  // Modal close
  $("modalClose").addEventListener("click", hideModal);
  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") hideModal();
  });
}

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupVisitControls();
  setupVisionAttachments();
  setupRelayUpload();
  setupRecorder();
  setupButtons();
  checkBackendReachable();
});
