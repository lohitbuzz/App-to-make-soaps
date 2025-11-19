// frontend/app.js

// IMPORTANT: your live Render backend URL
const BACKEND_URL = "https://lohit-soap-app.onrender.com/api/soap";

(function () {
  // Elements
  const modeSelect = document.getElementById("modeSelect");
  const statusMessage = document.getElementById("statusMessage");
  const soapOutput = document.getElementById("soapOutput");
  const copyOutputBtn = document.getElementById("btnCopyOutput");

  // Tab buttons & sections
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const tabSections = {
    appointment: document.getElementById("appointmentSection"),
    surgery: document.getElementById("surgerySection"),
    toolbox: document.getElementById("toolboxSection"),
    consult: document.getElementById("consultSection"),
  };

  // Appointment inputs
  const apptReason = document.getElementById("apptReason");
  const apptHistory = document.getElementById("apptHistory");
  const apptPE = document.getElementById("apptPE");
  const apptDiagnostics = document.getElementById("apptDiagnostics");
  const apptAssessment = document.getElementById("apptAssessment");
  const apptPlan = document.getElementById("apptPlan");
  const apptMeds = document.getElementById("apptMeds");
  const btnAppt = document.getElementById("btnAppt");

  // Surgery inputs
  const sxType = document.getElementById("sxType");
  const sxASA = document.getElementById("sxASA");
  const sxNotes = document.getElementById("sxNotes");
  const sxMeds = document.getElementById("sxMeds");
  const btnSx = document.getElementById("btnSx");

  // Toolbox inputs
  const toolboxInput = document.getElementById("toolboxInput");
  const btnToolbox = document.getElementById("btnToolbox");

  // Consult inputs
  const consultMessage = document.getElementById("consultMessage");
  const btnConsult = document.getElementById("btnConsult");

  // ------- Helpers -------

  function setStatus(text) {
    statusMessage.textContent = text;
  }

  async function callBackend(payload) {
    setStatus("Thinking…");
    soapOutput.value = "";

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const message = errData?.error || `HTTP ${res.status}`;
        setStatus(`Error: ${message}`);
        soapOutput.value = "";
        return;
      }

      const data = await res.json();
      if (!data || !data.ok || !data.text) {
        setStatus("Error: no text returned from backend.");
        soapOutput.value = "";
        return;
      }

      soapOutput.value = data.text;
      setStatus("Done.");
    } catch (err) {
      console.error("Frontend error calling backend:", err);
      setStatus("Error: could not reach backend.");
      soapOutput.value = "";
    }
  }

  function buildAppointmentText() {
    return [
      "APPOINTMENT CASE",
      "",
      `Reason: ${apptReason.value || "(not provided)"}`,
      `History: ${apptHistory.value || "(not provided)"}`,
      `PE (findings only): ${apptPE.value || "(not provided)"}`,
      `Diagnostics (data-only): ${apptDiagnostics.value || "(not provided)"}`,
      `Assessment (doctor notes): ${apptAssessment.value || "(not provided)"}`,
      `Plan (doctor notes): ${apptPlan.value || "(not provided)"}`,
      `Meds dispensed (doctor notes): ${apptMeds.value || "(not provided)"}`,
    ].join("\n");
  }

  function buildSurgeryText() {
    return [
      "SURGERY CASE",
      "",
      `Case type / template: ${sxType.value || "(not provided)"}`,
      `ASA status: ${sxASA.value || "(not provided)"}`,
      "",
      "Surgery notes:",
      sxNotes.value || "(not provided)",
      "",
      "Meds dispensed / recovery notes:",
      sxMeds.value || "(not provided)",
    ].join("\n");
  }

  function buildToolboxText() {
    return [
      "TOOLBOX LITE REQUEST",
      "",
      toolboxInput.value || "(no content provided)",
    ].join("\n");
  }

  function buildConsultText() {
    return [
      "CONSULT WITH DR. LOHIT",
      "",
      consultMessage.value || "(no question provided)",
    ].join("\n");
  }

  // ------- Tab handling -------

  tabs.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      tabs.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");

      Object.entries(tabSections).forEach(([name, section]) => {
        if (name === tabName) {
          section.classList.add("active");
        } else {
          section.classList.remove("active");
        }
      });

      setStatus(`Ready (${tabName}).`);
    });
  });

  // ------- Button handlers -------

  btnAppt.addEventListener("click", () => {
    const mode = modeSelect.value;
    const intakeText = buildAppointmentText();

    callBackend({
      mode,
      tab: "appointment",
      intakeText,
    });
  });

  btnSx.addEventListener("click", () => {
    const mode = modeSelect.value;
    const intakeText = buildSurgeryText();

    callBackend({
      mode,
      tab: "surgery",
      intakeText,
    });
  });

  btnToolbox.addEventListener("click", () => {
    const mode = modeSelect.value;
    const intakeText = buildToolboxText();

    callBackend({
      mode,
      tab: "toolbox",
      intakeText,
    });
  });

  btnConsult.addEventListener("click", () => {
    const mode = modeSelect.value;
    const intakeText = buildConsultText();

    callBackend({
      mode,
      tab: "consult",
      intakeText,
    });
  });

  // Copy output
  copyOutputBtn.addEventListener("click", () => {
    if (!soapOutput.value) return;
    soapOutput.select();
    document.execCommand("copy");
    setStatus("Copied to clipboard.");
  });

  // Initial state
  setStatus("Ready.");
})();