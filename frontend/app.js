// frontend/app.js

// 👉 IMPORTANT: update this if Render URL changes
const BACKEND_BASE_URL = "https://lohit-soap-app.onrender.com";

const SOAP_URL = `${BACKEND_BASE_URL}/api/soap`;
const VISION_URL = `${BACKEND_BASE_URL}/api/vision`;
const FEEDBACK_URL = `${BACKEND_BASE_URL}/api/feedback`;

(function () {
  // Elements
  const modeSelect = document.getElementById("modeSelect");
  const statusMessage = document.getElementById("statusMessage");
  const attachmentsInput = document.getElementById("attachmentsInput");

  const tabAppointment = document.getElementById("tabAppointment");
  const tabSurgery = document.getElementById("tabSurgery");
  const tabToolbox = document.getElementById("tabToolbox");
  const tabConsult = document.getElementById("tabConsult");

  const appointmentSection = document.getElementById("appointmentSection");
  const surgerySection = document.getElementById("surgerySection");
  const toolboxSection = document.getElementById("toolboxSection");
  const consultSection = document.getElementById("consultSection");

  const soapOutput = document.getElementById("soapOutput");
  const soapFeedbackInput = document.getElementById("soapFeedbackInput");
  const improveSoapBtn = document.getElementById("improveSoapBtn");
  const copySoapBtn = document.getElementById("copySoapBtn");

  const generateApptSoapBtn = document.getElementById("generateApptSoapBtn");
  const generateSxSoapBtn = document.getElementById("generateSxSoapBtn");

  const toolboxInput = document.getElementById("toolboxInput");
  const toolboxOutput = document.getElementById("toolboxOutput");
  const toolboxGenerateBtn = document.getElementById("toolboxGenerateBtn");
  const toolboxRefineBtn = document.getElementById("toolboxRefineBtn");

  const consultMessage = document.getElementById("consultMessage");
  const consultOutput = document.getElementById("consultOutput");
  const consultAskBtn = document.getElementById("consultAskBtn");

  let activeTab = "appointment";

  // ----------- Helpers ----------

  function setStatus(msg) {
    statusMessage.textContent = msg;
  }

  function switchTab(tab) {
    activeTab = tab;

    // buttons
    [tabAppointment, tabSurgery, tabToolbox, tabConsult].forEach((btn) =>
      btn.classList.remove("active")
    );

    if (tab === "appointment") tabAppointment.classList.add("active");
    if (tab === "surgery") tabSurgery.classList.add("active");
    if (tab === "toolbox") tabToolbox.classList.add("active");
    if (tab === "consult") tabConsult.classList.add("active");

    // sections
    appointmentSection.classList.add("hidden");
    surgerySection.classList.add("hidden");
    toolboxSection.classList.add("hidden");
    consultSection.classList.add("hidden");

    if (tab === "appointment") appointmentSection.classList.remove("hidden");
    if (tab === "surgery") surgerySection.classList.remove("hidden");
    if (tab === "toolbox") toolboxSection.classList.remove("hidden");
    if (tab === "consult") consultSection.classList.remove("hidden");
  }

  function readAttachmentsAsDataUrls() {
    const input = attachmentsInput;
    if (!input || !input.files || input.files.length === 0) return Promise.resolve([]);

    const files = Array.from(input.files);
    const promises = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              type: file.type,
              data: reader.result, // data URL
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );

    return Promise.all(promises);
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text || "Request failed"}`);
    }

    return res.json();
  }

  function copyToClipboard(text) {
    if (!navigator.clipboard) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return;
    }
    navigator.clipboard.writeText(text);
  }

  // ----------- SOAP generation ----------

  async function generateSoap(caseType) {
    try {
      setStatus("Generating SOAP...");
      soapOutput.value = "";

      const images = await readAttachmentsAsDataUrls();

      const mode = modeSelect.value || "Help Me";

      const appointment = {
        reason: document.getElementById("apptReason").value,
        history: document.getElementById("apptHistory").value,
        pe: document.getElementById("apptPE").value,
        diagnostics: document.getElementById("apptDiagnostics").value,
        assessmentHints: document.getElementById("apptAssessment").value,
        planHints: document.getElementById("apptPlan").value,
        medsDispensedHints: document.getElementById("apptMedsDispensed").value,
      };

      const surgery = {
        reason: document.getElementById("sxReason").value,
        history: document.getElementById("sxHistory").value,
        pe: document.getElementById("sxPE").value,
        diagnostics: document.getElementById("sxDiagnostics").value,
        procedureNotes: document.getElementById("sxProcedureNotes").value,
        recovery: document.getElementById("sxRecovery").value,
        medsDispensedHints: document.getElementById("sxMedsDispensed").value,
      };

      const payload = {
        mode,
        caseType,
        appointment,
        surgery,
        consultMessage: consultMessage.value || "",
        images,
      };

      const data = await postJSON(SOAP_URL, payload);
      soapOutput.value = data.text || "";
      setStatus("SOAP ready.");
    } catch (err) {
      console.error(err);
      setStatus("Error generating SOAP.");
      soapOutput.value = `Error: ${err.message}`;
    }
  }

  // ----------- Toolbox ----------

  async function runToolbox(mainRequest) {
    try {
      setStatus("Working on Toolbox...");
      toolboxOutput.value = "";

      const images = await readAttachmentsAsDataUrls();
      const prompt =
        mainRequest ||
        toolboxInput.value ||
        "Make a short bloodwork/lab blurb for the medical record and a client-friendly line.";

      const data = await postJSON(VISION_URL, {
        prompt,
        images,
      });

      toolboxOutput.value = data.text || "";
      setStatus("Toolbox output ready.");
    } catch (err) {
      console.error(err);
      setStatus("Error in Toolbox.");
      toolboxOutput.value = `Error: ${err.message}`;
    }
  }

  async function refineToolbox() {
    try {
      if (!toolboxOutput.value.trim()) {
        return runToolbox();
      }
      setStatus("Refining Toolbox output...");
      const req =
        toolboxInput.value ||
        "Make this clearer and a bit shorter, keep all clinical details.";
      const data = await postJSON(FEEDBACK_URL, {
        text: toolboxOutput.value,
        request: req,
        context: "toolbox",
      });
      toolboxOutput.value = data.text || "";
      setStatus("Refined.");
    } catch (err) {
      console.error(err);
      setStatus("Error refining Toolbox.");
    }
  }

  // ----------- SOAP feedback ----------

  async function improveSoap() {
    try {
      const base = soapOutput.value;
      if (!base.trim()) {
        setStatus("No SOAP to improve yet.");
        return;
      }
      setStatus("Improving SOAP...");
      const req =
        soapFeedbackInput.value ||
        "Improve clarity and flow, keep the same clinical content.";
      const data = await postJSON(FEEDBACK_URL, {
        text: base,
        request: req,
        context: "soap",
      });
      soapOutput.value = data.text || "";
      setStatus("SOAP improved.");
    } catch (err) {
      console.error(err);
      setStatus("Error improving SOAP.");
    }
  }

  // ----------- Consult ----------

  async function runConsult() {
    try {
      if (!consultMessage.value.trim()) {
        setStatus("Type a consult question first.");
        return;
      }
      setStatus("Thinking about consult...");
      consultOutput.value = "";
      const data = await postJSON(FEEDBACK_URL, {
        text: consultMessage.value,
        request:
          "Answer this like a quick vet-to-vet chat note I can copy into my records or email.",
        context: "consult",
      });
      consultOutput.value = data.text || "";
      setStatus("Consult ready.");
    } catch (err) {
      console.error(err);
      setStatus("Error in consult.");
      consultOutput.value = `Error: ${err.message}`;
    }
  }

  // ----------- Events ----------

  tabAppointment.addEventListener("click", () => switchTab("appointment"));
  tabSurgery.addEventListener("click", () => switchTab("surgery"));
  tabToolbox.addEventListener("click", () => switchTab("toolbox"));
  tabConsult.addEventListener("click", () => switchTab("consult"));

  generateApptSoapBtn.addEventListener("click", () =>
    generateSoap("appointment")
  );
  generateSxSoapBtn.addEventListener("click", () => generateSoap("surgery"));

  toolboxGenerateBtn.addEventListener("click", () => runToolbox());
  toolboxRefineBtn.addEventListener("click", () => refineToolbox());

  improveSoapBtn.addEventListener("click", () => improveSoap());

  consultAskBtn.addEventListener("click", () => runConsult());

  copySoapBtn.addEventListener("click", () => {
    if (!soapOutput.value.trim()) return;
    copyToClipboard(soapOutput.value);
    setStatus("Full SOAP copied to clipboard.");
  });

  // Initial
  switchTab("appointment");
  setStatus("Ready.");
})();