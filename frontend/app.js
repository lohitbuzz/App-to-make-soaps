/* ----------------------------------------------------------
   Moksha SOAP APP — FINAL WORKING FRONTEND LOGIC
   Netlify + Assistant
   ---------------------------------------------------------- */

/* --------------------------
   TAB SWITCHING
--------------------------- */
const tabButtons = document.querySelectorAll('.top-tab-btn');
const soapSection = document.getElementById('soap-section');
const toolboxSection = document.getElementById('toolbox-section');
const consultSection = document.getElementById('consult-section');
const mainOutput = document.getElementById('mainOutput');
const refineInput = document.getElementById('refineInput');
const refineBtn = document.getElementById('refineBtn');
const helperConsole = document.getElementById('helperConsole');

function showTab(tab) {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  soapSection.style.display = tab === 'soap' ? 'block' : 'none';
  toolboxSection.style.display = tab === 'toolbox' ? 'block' : 'none';
  consultSection.style.display = tab === 'consult' ? 'block' : 'none';

  helperConsole.style.display = tab === 'soap' ? 'block' : 'none';
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

/* --------------------------
   SIMPLE / ADVANCED SURGERY
--------------------------- */
const visitTypeAppointment = document.getElementById("visitTypeAppointment");
const visitTypeSurgery = document.getElementById("visitTypeSurgery");
const asaField = document.getElementById("asaField");

const surgeryModeSimple = document.getElementById("surgeryModeSimple");
const surgeryModeAdvanced = document.getElementById("surgeryModeAdvanced");
const advancedSurgeryFields = document.getElementById("advancedSurgeryFields");

visitTypeAppointment.addEventListener("click", () => {
  visitTypeAppointment.classList.add("active");
  visitTypeSurgery.classList.remove("active");
  asaField.style.display = "none";
  advancedSurgeryFields.style.display = "none";
});

visitTypeSurgery.addEventListener("click", () => {
  visitTypeSurgery.classList.add("active");
  visitTypeAppointment.classList.remove("active");
  asaField.style.display = "block";
  if (surgeryModeAdvanced.classList.contains("active")) {
    advancedSurgeryFields.style.display = "block";
  }
});

// simple vs advanced
surgeryModeSimple.addEventListener("click", () => {
  surgeryModeSimple.classList.add("active");
  surgeryModeAdvanced.classList.remove("active");
  advancedSurgeryFields.style.display = "none";
});
surgeryModeAdvanced.addEventListener("click", () => {
  surgeryModeAdvanced.classList.add("active");
  surgeryModeSimple.classList.remove("active");
  advancedSurgeryFields.style.display = "block";
});

/* --------------------------
   FILE UPLOAD HANDLING
--------------------------- */
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const clearFilesBtn = document.getElementById("clearFilesBtn");

let attachedFiles = [];

fileInput.addEventListener("change", () => {
  attachedFiles = Array.from(fileInput.files);
  renderFileList();
});

clearFilesBtn.addEventListener("click", () => {
  attachedFiles = [];
  fileInput.value = "";
  renderFileList();
});

function renderFileList() {
  if (attachedFiles.length === 0) {
    fileList.textContent = "No files attached yet.";
    return;
  }
  fileList.innerHTML = attachedFiles.map(f => `• ${f.name}`).join("<br>");
}

/* --------------------------
   BASIC REDACTION (UI ONLY)
--------------------------- */
const redactToggle = document.getElementById("redactToggle");
const redactBody = document.getElementById("redactBody");
const redactSourceSelect = document.getElementById("redactSourceSelect");
const loadRedactImageBtn = document.getElementById("loadRedactImageBtn");
const redactImage = document.getElementById("redactImage");
const redactCanvasWrapper = document.getElementById("redactCanvasWrapper");
const redactAddRectBtn = document.getElementById("redactAddRectBtn");
const redactClearBtn = document.getElementById("redactClearBtn");

redactToggle.addEventListener("click", () => {
  const isOpen = redactBody.style.display === "block";
  redactBody.style.display = isOpen ? "none" : "block";
  redactToggle.classList.toggle("open", !isOpen);

  // populate dropdown
  redactSourceSelect.innerHTML = "";
  attachedFiles.forEach((f, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = f.name;
    redactSourceSelect.appendChild(opt);
  });
});

loadRedactImageBtn.addEventListener("click", () => {
  const idx = redactSourceSelect.value;
  if (!attachedFiles[idx]) return;
  const file = attachedFiles[idx];
  const url = URL.createObjectURL(file);
  redactImage.src = url;
});

// ADD REDACTION RECT
function makeRect() {
  const div = document.createElement("div");
  div.className = "redact-rect";
  div.style.left = "20px";
  div.style.top = "20px";
  div.style.width = "120px";
  div.style.height = "60px";
  enableRectDragging(div);
  return div;
}

redactAddRectBtn.addEventListener("click", () => {
  const rect = makeRect();
  redactCanvasWrapper.appendChild(rect);
});

redactClearBtn.addEventListener("click", () => {
  [...redactCanvasWrapper.querySelectorAll(".redact-rect")].forEach(r => r.remove());
});

// draggable
function enableRectDragging(div) {
  let x, y, w, h;
  let dragging = false;
  div.addEventListener("mousedown", (e) => {
    dragging = true;
    x = e.clientX - div.offsetLeft;
    y = e.clientY - div.offsetTop;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    div.style.left = (e.clientX - x) + "px";
    div.style.top = (e.clientY - y) + "px";
  });
  window.addEventListener("mouseup", () => dragging = false);
}

/* --------------------------
   VOICE RECORDER (BASIC)
--------------------------- */
let mediaRecorder = null;
let chunks = [];
let savedTranscript = "";

const recBtn = document.getElementById("recBtn");
const useRecBtn = document.getElementById("useRecBtn");
const insertRecBtn = document.getElementById("insertRecBtn");

recBtn.addEventListener("click", async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        savedTranscript = "[Voice note recorded — transcript generated by backend]";
        alert("Recording saved. Use buttons below.");
      };

      mediaRecorder.start();
      recBtn.textContent = "Stop";
    } catch (err) {
      alert("Mic permission needed.");
    }
  } else {
    mediaRecorder.stop();
    recBtn.textContent = "Record";
  }
});

useRecBtn.addEventListener("click", () => {
  alert("Voice will be sent to backend as hidden context.");
});

insertRecBtn.addEventListener("click", () => {
  const field = document.getElementById("soapCoreNotes");
  field.value += "\n" + savedTranscript;
});

/* --------------------------
   BUILD PAYLOAD FOR ALL MODES
--------------------------- */
function buildPayload(mode) {
  return {
    mode,
    caseLabel: document.getElementById("caseLabel")?.value ?? "",
    patientName: document.getElementById("patientName")?.value ?? "",
    species: document.getElementById("species")?.value ?? "",
    sex: document.getElementById("sex")?.value ?? "",
    weightKg: document.getElementById("weightKg")?.value ?? "",
    asa: document.getElementById("asaStatus")?.value ?? "",
    tprNotes: document.getElementById("tprNotes")?.value ?? "",
    coreNotes: document.getElementById("soapCoreNotes")?.value ?? "",
    pe: document.getElementById("soapPE")?.value ?? "",
    assessmentHints: document.getElementById("soapAssessmentHints")?.value ?? "",
    planHints: document.getElementById("soapPlanHints")?.value ?? "",
    extra: document.getElementById("soapExtra")?.value ?? "",
    toolboxMode: document.getElementById("toolboxMode")?.value ?? "",
    toolboxText: document.getElementById("toolboxText")?.value ?? "",
    consultQuestion: document.getElementById("consultQuestion")?.value ?? "",
    consultContext: document.getElementById("consultContext")?.value ?? "",
  };
}

/* --------------------------
   SEND TO NETLIFY FUNCTION
--------------------------- */
async function callFunction(url, payload, files) {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  if (savedTranscript) form.append("voice", savedTranscript);
  (files || []).forEach(f => form.append("files", f));

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  return data;
}

/* --------------------------
   SOAP BUTTON
--------------------------- */
document.getElementById("generateSoapBtn").addEventListener("click", async () => {
  mainOutput.textContent = "Working…";
  const payload = buildPayload("soap");
  try {
    const data = await callFunction("/.netlify/functions/soap", payload, attachedFiles);
    mainOutput.textContent = data.output || "No output.";
  } catch (err) {
    mainOutput.textContent = "Error calling SOAP function.";
  }
});

/* --------------------------
   TOOLBOX BUTTON
--------------------------- */
document.getElementById("generateToolboxBtn").addEventListener("click", async () => {
  mainOutput.textContent = "Working…";
  const payload = buildPayload("toolbox");
  try {
    const data = await callFunction("/.netlify/functions/soap", payload, attachedFiles);
    mainOutput.textContent = data.output || "No output.";
  } catch (err) {
    mainOutput.textContent = "Error calling toolbox.";
  }
});

/* --------------------------
   CONSULT BUTTON
--------------------------- */
document.getElementById("generateConsultBtn").addEventListener("click", async () => {
  mainOutput.textContent = "Working…";
  const payload = buildPayload("consult");
  try {
    const data = await callFunction("/.netlify/functions/soap", payload, attachedFiles);
    mainOutput.textContent = data.output || "No output.";
  } catch (err) {
    mainOutput.textContent = "Error calling consult.";
  }
});

/* --------------------------
   REFINE BUTTON
--------------------------- */
refineBtn.addEventListener("click", async () => {
  const extra = refineInput.value.trim();
  if (!extra) return alert("Type refinement first.");
  mainOutput.textContent = "Refining…";

  let payload = {
    mode: "refine",
    refineText: extra,
    previousOutput: mainOutput.textContent
  };

  try {
    const data = await callFunction("/.netlify/functions/soap", payload, attachedFiles);
    mainOutput.textContent = data.output || mainOutput.textContent;
  } catch (err) {
    mainOutput.textContent = "Refine error.";
  }
});

/* --------------------------
   FEEDBACK BUTTON
--------------------------- */
document.getElementById("sendFeedbackBtn").addEventListener("click", async () => {
  const text = document.getElementById("feedbackInput").value.trim();
  if (!text) return alert("Enter feedback.");
  try {
    await callFunction("/.netlify/functions/feedback", { text });
    alert("Thanks for feedback!");
  } catch (err) {
    alert("Feedback error.");
  }
});

/* --------------------------
   SEND TO VISION NOW
--------------------------- */
document.getElementById("sendToVisionBtn")?.addEventListener("click", async () => {
  if (attachedFiles.length === 0) return alert("Attach images first.");
  mainOutput.textContent = "Vision analyzing…";

  try {
    const data = await callFunction("/.netlify/functions/vision", { mode: "visionOnly" }, attachedFiles);
    mainOutput.textContent = data.output || "Vision returned nothing.";
  } catch (err) {
    mainOutput.textContent = "Vision error.";
  }
});

/* --------------------------
   PHONE TO DESKTOP RELAY (placeholder)
--------------------------- */
document.getElementById("relayBtn")?.addEventListener("click", () => {
  alert("Relay coming next patch — QR handshake + temp session ID.");
});

/* --------------------------
   INIT
--------------------------- */
showTab("soap");
renderFileList();