/* ============================================================
   MOKSHA SOAP — APP.JS (FINAL)
   Assistant API + Vision + Recorder + Toolbox + Consult
   Works with Netlify backend functions
============================================================ */

// ---------- CONFIG ----------
const SOAP_URL = "/.netlify/functions/soap";
const VISION_URL = "/.netlify/functions/vision";
const FEEDBACK_URL = "/.netlify/functions/feedback";

// -------------------------------------------------------------
// DOM SHORTCUTS
// -------------------------------------------------------------
const $ = (id) => document.getElementById(id);

// Tabs
const tabAppointment = $("tabAppointment");
const tabSurgery = $("tabSurgery");
const tabToolbox = $("tabToolbox");
const tabConsult = $("tabConsult");

// Sections
const appointmentSection = $("appointmentSection");
const surgerySection = $("surgerySection");
const toolboxSection = $("toolboxSection");
const consultSection = $("consultSection");

// Global upload (Vision)
const globalFileInput = $("globalFileInput");

// SOAP Output + Feedback
const soapOutput = $("soapOutput");
const soapFeedbackInput = $("soapFeedbackInput");
const improveSoapBtn = $("improveSoapBtn");

// Toolbox
const toolboxSelect = $("toolboxSelect");
const toolboxInput = $("toolboxInput");
const toolboxOutput = $("toolboxOutput");
const toolboxGenerateBtn = $("toolboxGenerateBtn");
const toolboxRefineBtn = $("toolboxRefineBtn");

// Consult
const consultMessage = $("consultMessage");
const consultOutput = $("consultOutput");
const consultAskBtn = $("consultAskBtn");

// Recorder (collapsible)
const recorderBlock = $("recorderBlock");
const recorderHeader = $("recorderHeader");
const recorderContent = $("recorderContent");
const recordBtn = $("recordBtn");
const saveClipBtn = $("saveClipBtn");
const sendTranscriptBtn = $("sendTranscriptBtn");
const transcriptBox = $("transcriptBox");

// Status
const statusMessage = $("statusMessage");

let recorder;
let audioChunks = [];
let isRecording = false;

// -------------------------------------------------------------
// TAB SWITCHER
// -------------------------------------------------------------
function switchTab(tab) {
  tabAppointment.classList.remove("active");
  tabSurgery.classList.remove("active");
  tabToolbox.classList.remove("active");
  tabConsult.classList.remove("active");

  appointmentSection.classList.add("hidden");
  surgerySection.classList.add("hidden");
  toolboxSection.classList.add("hidden");
  consultSection.classList.add("hidden");

  if (tab === "appointment") {
    tabAppointment.classList.add("active");
    appointmentSection.classList.remove("hidden");
  }
  if (tab === "surgery") {
    tabSurgery.classList.add("active");
    surgerySection.classList.remove("hidden");
  }
  if (tab === "toolbox") {
    tabToolbox.classList.add("active");
    toolboxSection.classList.remove("hidden");
  }
  if (tab === "consult") {
    tabConsult.classList.add("active");
    consultSection.classList.remove("hidden");
  }
}

// -------------------------------------------------------------
// FILE READING FOR VISION
// -------------------------------------------------------------
async function readFilesAsBase64(input) {
  if (!input || !input.files || input.files.length === 0) return [];

  const files = Array.from(input.files);
  const convert = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          data: reader.result,
        });
      reader.readAsDataURL(file);
    });

  return Promise.all(files.map(convert));
}

// -------------------------------------------------------------
// GENERIC POST
// -------------------------------------------------------------
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Bad JSON from server: " + text);
  }
}

// -------------------------------------------------------------
// SOAP GENERATOR
// -------------------------------------------------------------
async function generateSOAP(caseType) {
  try {
    statusMessage.textContent = "Generating SOAP…";
    soapOutput.value = "";

    const images = await readFilesAsBase64(globalFileInput);

    const appointment = {
      reason: $("apptReason")?.value || "",
      history: $("apptHistory")?.value || "",
      pe: $("apptPE")?.value || "",
      diagnostics: $("apptDiagnostics")?.value || "",
      assessmentHints: $("apptAssessment")?.value || "",
      planHints: $("apptPlan")?.value || "",
      medsDispensedHints: $("apptMedsDispensed")?.value || "",
    };

    const surgery = {
      reason: $("sxReason")?.value || "",
      history: $("sxHistory")?.value || "",
      pe: $("sxPE")?.value || "",
      diagnostics: $("sxDiagnostics")?.value || "",
      procedureNotes: $("sxProcedureNotes")?.value || "",
      recovery: $("sxRecovery")?.value || "",
      medsDispensedHints: $("sxMedsDispensed")?.value || "",
    };

    const payload = {
      caseType,
      appointment,
      surgery,
      images,
      transcript: transcriptBox.value.trim() || "",
    };

    const data = await postJSON(SOAP_URL, payload);

    soapOutput.value = data.text || "(No SOAP returned)";
    statusMessage.textContent = "SOAP ready.";
  } catch (err) {
    soapOutput.value = "Error: " + err.message;
    statusMessage.textContent = "Error generating SOAP.";
  }
}

// -------------------------------------------------------------
// SOAP REFINER
// -------------------------------------------------------------
async function refineSOAP() {
  try {
    if (!soapOutput.value.trim()) return;
    statusMessage.textContent = "Refining…";

    const data = await postJSON(FEEDBACK_URL, {
      text: soapOutput.value,
      request:
        soapFeedbackInput.value ||
        "Improve clarity and formatting while keeping all details.",
      context: "soap",
    });

    soapOutput.value = data.text;
    statusMessage.textContent = "Refined.";
  } catch (err) {
    statusMessage.textContent = "Refinement error.";
  }
}

// -------------------------------------------------------------
// TOOLBOX PROCESSING
// -------------------------------------------------------------
async function runToolbox() {
  try {
    statusMessage.textContent = "Running Toolbox…";
    toolboxOutput.value = "";

    const images = await readFilesAsBase64(globalFileInput);

    const data = await postJSON(VISION_URL, {
      prompt: toolboxInput.value || "Process using toolbox mode.",
      type: toolboxSelect.value,
      images,
      transcript: transcriptBox.value.trim(),
    });

    toolboxOutput.value = data.text || "(No output)";
    statusMessage.textContent = "Toolbox done.";
  } catch (err) {
    toolboxOutput.value = "Error: " + err.message;
    statusMessage.textContent = "Toolbox error.";
  }
}

async function refineToolbox() {
  try {
    if (!toolboxOutput.value.trim()) return;
    statusMessage.textContent = "Refining…";

    const data = await postJSON(FEEDBACK_URL, {
      text: toolboxOutput.value,
      request: "Make clearer but keep details.",
      context: "toolbox",
    });

    toolboxOutput.value = data.text;
    statusMessage.textContent = "Refined.";
  } catch (err) {
    statusMessage.textContent = "Error refining toolbox.";
  }
}

// -------------------------------------------------------------
// CONSULT ENGINE
// -------------------------------------------------------------
async function runConsult() {
  try {
    if (!consultMessage.value.trim()) return;

    statusMessage.textContent = "Thinking…";
    consultOutput.value = "";

    const images = await readFilesAsBase64(globalFileInput);

    const data = await postJSON(FEEDBACK_URL, {
      text: consultMessage.value,
      request: "Answer as a clean vet-to-vet consult note.",
      images,
      transcript: transcriptBox.value.trim(),
      context: "consult",
    });

    consultOutput.value = data.text;
    statusMessage.textContent = "Consult ready.";
  } catch (err) {
    consultOutput.value = "Error: " + err.message;
    statusMessage.textContent = "Consult error.";
  }
}

// -------------------------------------------------------------
// RECORDER ENGINE
// -------------------------------------------------------------
recorderHeader.addEventListener("click", () => {
  recorderContent.classList.toggle("hidden");
});

// START/STOP RECORDING
recordBtn.addEventListener("click", async () => {
  if (!isRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (e) => audioChunks.push(e.data);
    recorder.onstop = async () => {
      // Auto transcribe on STOP? No — we use buttons below.
    };

    audioChunks = [];
    recorder.start();
    recordBtn.textContent = "Stop Recording";
    recordBtn.style.background = "#ff5f5f";
    isRecording = true;
  } else {
    recorder.stop();
    recordBtn.textContent = "Record";
    recordBtn.style.background = "#4a98ff";
    isRecording = false;
  }
});

// Save as a recording clip (for sending to backend)
saveClipBtn.addEventListener("click", () => {
  if (audioChunks.length === 0) return alert("No audio recorded.");

  const blob = new Blob(audioChunks, { type: "audio/webm" });
  const file = new File([blob], "recording.webm", { type: "audio/webm" });

  // Attach to global uploader
  const dt = new DataTransfer();
  dt.items.add(file);

  // Append to any existing files
  const old = globalFileInput.files;
  if (old.length > 0) {
    for (let i = 0; i < old.length; i++) dt.items.add(old[i]);
  }

  globalFileInput.files = dt.files;

  alert("Recording saved. It will be used in SOAP/Toolbox/Consult.");
});

// Transcribe → transcriptBox
sendTranscriptBtn.addEventListener("click", async () => {
  if (audioChunks.length === 0) return alert("Nothing to transcribe.");

  const blob = new Blob(audioChunks, { type: "audio/webm" });
  const reader = new FileReader();
  reader.onload = async () => {
    transcriptBox.textContent =
      "(Transcription placeholder — backend transcriber coming in next update)";
  };
  reader.readAsDataURL(blob);
});

// -------------------------------------------------------------
// TAB EVENTS
// -------------------------------------------------------------
tabAppointment.addEventListener("click", () => switchTab("appointment"));
tabSurgery.addEventListener("click", () => switchTab("surgery"));
tabToolbox.addEventListener("click", () => switchTab("toolbox"));
tabConsult.addEventListener("click", () => switchTab("consult"));

// Buttons
$("generateApptSoapBtn").addEventListener("click", () =>
  generateSOAP("appointment")
);
$("generateSxSoapBtn").addEventListener("click", () =>
  generateSOAP("surgery")
);

improveSoapBtn.addEventListener("click", refineSOAP);

toolboxGenerateBtn.addEventListener("click", runToolbox);
toolboxRefineBtn.addEventListener("click", refineToolbox);

consultAskBtn.addEventListener("click", runConsult);

// -------------------------------------------------------------
// INIT
// -------------------------------------------------------------
switchTab("appointment");
statusMessage.textContent = "Ready.";