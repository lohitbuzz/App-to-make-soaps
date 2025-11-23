// ==========================================================
// Moksha SOAP App - FINAL APP.JS
// Netlify + Assistant API + Vision + Recorder
// ==========================================================

// ---------- CONFIG ----------
const ASSISTANT_ID = "asst_4sHUgx1lQ7Ob4KJtgkKQvsTb";

const API_SOAP = "/.netlify/functions/soap";
const API_VISION = "/.netlify/functions/vision";
const API_FEEDBACK = "/.netlify/functions/feedback";
const API_RELAY = "/.netlify/functions/relay";

// ==========================================================
// Utility Helpers
// ==========================================================
function $(id) {
    return document.getElementById(id);
}

function setStatus(msg) {
    const line = $("statusMessage");
    if (line) line.textContent = msg;
}

function copyText(txt) {
    navigator.clipboard.writeText(txt || "");
}

// Read files as base64 Data URLs
async function readFiles(inputElem) {
    if (!inputElem || !inputElem.files) return [];
    const files = Array.from(inputElem.files);

    const promises = files.map(
        (file) =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                    resolve({
                        name: file.name,
                        type: file.type,
                        data: reader.result,
                    });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            })
    );

    return Promise.all(promises);
}

// POST JSON helper
async function postJSON(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
    }

    return res.json();
}

// ==========================================================
// TABS
// ==========================================================
function setupTabs() {
    const map = {
        tabAppointment: "appointmentSection",
        tabSurgery: "surgerySection",
        tabToolbox: "toolboxSection",
        tabConsult: "consultSection",
        tabTransfer: "transferSection"
    };

    Object.keys(map).forEach((tabId) => {
        $(tabId).addEventListener("click", () => {
            Object.values(map).forEach((sec) => $(sec).classList.add("hidden"));
            Object.keys(map).forEach((t) => $(t).classList.remove("active"));
            $(map[tabId]).classList.remove("hidden");
            $(tabId).classList.add("active");
        });
    });
}

// ==========================================================
// SOAP GENERATION (Appointment + Surgery)
// ==========================================================
async function generateAppointmentSOAP() {
    try {
        setStatus("Generating SOAP...");
        const imgs = await readFiles($("apptFiles"));

        // transcript if checked
        let transcript = "";
        if ($("useTranscriptForSoap").checked)
            transcript = $("recordingTranscript").value || "";

        const payload = {
            assistantId: ASSISTANT_ID,
            mode: "appointment",
            fields: {
                reason: $("apptReason").value,
                history: $("apptHistory").value,
                pe: $("apptPE").value,
                diagnostics: $("apptDiagnostics").value,
                assessmentHints: $("apptAssessment").value,
                planHints: $("apptPlan").value,
                medsHints: $("apptMeds").value,
                transcript,
            },
            images: imgs,
        };

        const data = await postJSON(API_SOAP, payload);
        $("soapOutput").value = data.output || "";
        setStatus("SOAP ready.");
    } catch (e) {
        $("soapOutput").value = "Error: " + e.message;
        setStatus("Error.");
    }
}

async function generateSurgerySOAP() {
    try {
        setStatus("Generating Surgery SOAP...");

        const imgs = await readFiles($("sxFiles"));
        let transcript = "";
        if ($("useTranscriptForSx").checked)
            transcript = $("recordingTranscriptSx").value || "";

        const payload = {
            assistantId: ASSISTANT_ID,
            mode: "surgery",
            fields: {
                reason: $("sxReason").value,
                history: $("sxHistory").value,
                pe: $("sxPE").value,
                diagnostics: $("sxDiagnostics").value,
                procedureNotes: $("sxProcedureNotes").value,
                recovery: $("sxRecovery").value,
                medsDispensed: $("sxMedsDispensed").value,

                premed: $("premedSelect").value,
                induction: $("inductionSelect").value,
                intraOp: $("intraOpMeds").value,
                postOp: $("postOpMeds").value,

                transcript,
            },
            images: imgs,
        };

        const data = await postJSON(API_SOAP, payload);
        $("soapOutputSx").value = data.output || "";
        setStatus("Surgery SOAP ready.");
    } catch (e) {
        $("soapOutputSx").value = "Error: " + e.message;
        setStatus("Error.");
    }
}

// ==========================================================
// FEEDBACK REFINE (SOAP + Surgery + Toolbox + Consult)
// ==========================================================
async function refineSOAP() {
    try {
        const base = $("soapOutput").value;
        const req = $("soapFeedbackInput").value || "Improve clarity.";
        const data = await postJSON(API_FEEDBACK, {
            assistantId: ASSISTANT_ID,
            text: base,
            request: req,
            context: "soap",
        });
        $("soapOutput").value = data.output || "";
    } catch (e) {
        setStatus("Feedback error.");
    }
}

async function refineSurgerySOAP() {
    try {
        const base = $("soapOutputSx").value;
        const req = $("sxFeedbackInput").value || "Improve clarity.";
        const data = await postJSON(API_FEEDBACK, {
            assistantId: ASSISTANT_ID,
            text: base,
            request: req,
            context: "surgery",
        });
        $("soapOutputSx").value = data.output || "";
    } catch (e) {
        setStatus("Feedback error.");
    }
}

async function refineToolbox() {
    try {
        const base = $("toolboxOutput").value;
        const req =
            $("toolboxFeedbackInput").value ||
            "Polish and simplify while keeping all clinical details.";

        const data = await postJSON(API_FEEDBACK, {
            assistantId: ASSISTANT_ID,
            text: base,
            request: req,
            context: "toolbox",
        });

        $("toolboxOutput").value = data.output || "";
    } catch (e) {
        setStatus("Toolbox refine error.");
    }
}

async function refineConsult() {
    try {
        const base = $("consultOutput").value;
        const req =
            $("consultFeedbackInput").value ||
            "Improve for clarity and vet communication.";

        const data = await postJSON(API_FEEDBACK, {
            assistantId: ASSISTANT_ID,
            text: base,
            request: req,
            context: "consult",
        });

        $("consultOutput").value = data.output || "";
    } catch (e) {
        setStatus("Consult refine error.");
    }
}

// ==========================================================
// TOOLBOX (Vision + Modes)
// ==========================================================
async function runToolbox() {
    try {
        setStatus("Running Toolbox...");

        const imgs = await readFiles($("toolboxFiles"));
        const mode = $("toolboxMode").value;
        const prompt = $("toolboxInput").value;

        const payload = {
            assistantId: ASSISTANT_ID,
            mode,
            prompt,
            images: imgs,
        };

        const data = await postJSON(API_VISION, payload);
        $("toolboxOutput").value = data.output || "";
        setStatus("Toolbox ready.");
    } catch (e) {
        $("toolboxOutput").value = "Error: " + e.message;
        setStatus("Error.");
    }
}

// ==========================================================
// CONSULT
// ==========================================================
async function runConsult() {
    try {
        setStatus("Thinking...");
        const imgs = await readFiles($("consultFiles"));
        const payload = {
            assistantId: ASSISTANT_ID,
            question: $("consultMessage").value,
            images: imgs,
        };

        const data = await postJSON(API_SOAP, payload);
        $("consultOutput").value = data.output || "";
        setStatus("Consult ready.");
    } catch (e) {
        $("consultOutput").value = "Error: " + e.message;
        setStatus("Error.");
    }
}

// ==========================================================
// RELAY (Phone → Desktop)
// ==========================================================
async function generateRelayQR() {
    try {
        const { qr, code } = await postJSON(API_RELAY, {
            assistantId: ASSISTANT_ID,
            mode: "create",
        });

        window.currentRelayCode = code;
        $("relayQR").src = qr;
        setStatus("QR ready.");
    } catch (e) {
        setStatus("QR error.");
    }
}

// Poll messages
async function pollRelay() {
    if (!window.currentRelayCode) return;

    try {
        const data = await postJSON(API_RELAY, {
            assistantId: ASSISTANT_ID,
            mode: "check",
            code: window.currentRelayCode,
        });

        if (data.newContent) {
            $("relayOutput").value += "\n" + data.newContent;
        }
    } catch {}
}

setInterval(pollRelay, 4000);

// ==========================================================
// Voice Recorder
// ==========================================================
let mediaRecorder;
let audioChunks = [];

function setupRecorder() {
    async function startRecording(target) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: "audio/webm" });
            audioChunks = [];

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Audio = reader.result;

                if (target === "appt") $("recordingTranscript").value = "";
                if (target === "sx") $("recordingTranscriptSx").value = "";

                const data = await postJSON(API_VISION, {
                    assistantId: ASSISTANT_ID,
                    audio: base64Audio,
                    transcribe: true,
                });

                if (target === "appt")
                    $("recordingTranscript").value = data.output || "";
                else $("recordingTranscriptSx").value = data.output || "";
            };

            reader.readAsDataURL(blob);
        };

        mediaRecorder.start();
    }

    $("startRecordBtn").onclick = () => startRecording("appt");
    $("startRecordBtnSx").onclick = () => startRecording("sx");
}

// ==========================================================
// INIT
// ==========================================================
window.onload = function () {
    setupTabs();
    setupRecorder();

    $("generateApptSoapBtn").onclick = generateAppointmentSOAP;
    $("generateSxSoapBtn").onclick = generateSurgerySOAP;

    $("improveSoapBtn").onclick = refineSOAP;
    $("sxImproveBtn").onclick = refineSurgerySOAP;

    $("toolboxGenerateBtn").onclick = runToolbox;
    $("toolboxRefineBtn").onclick = refineToolbox;

    $("consultAskBtn").onclick = runConsult;
    $("consultRefineBtn").onclick = refineConsult;

    $("copySoapBtn").onclick = () =>
        copyText($("soapOutput").value);

    $("generateRelayQR").onclick = generateRelayQR;

    setStatus("Ready.");
};