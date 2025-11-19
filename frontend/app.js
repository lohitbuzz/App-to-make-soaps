const BACKEND_URL = "https://lohit-soap-app.onrender.com/api/soap";

(function () {
  // — Elements —
  const modeSelect = document.getElementById("modeSelect");
  const statusMessage = document.getElementById("statusMessage");
  const soapOutput = document.getElementById("soapOutput");

  // Tabs
  const tabAppointment = document.getElementById("tabAppointment");
  const tabSurgery = document.getElementById("tabSurgery");
  const tabToolbox = document.getElementById("tabToolbox");
  const tabConsult = document.getElementById("tabConsult");

  const appointmentSection = document.getElementById("appointmentSection");
  const surgerySection = document.getElementById("surgerySection");
  const toolboxSection = document.getElementById("toolboxSection");
  const consultSection = document.getElementById("consultSection");

  function setActiveTab(name) {
    tabAppointment.classList.remove("active");
    tabSurgery.classList.remove("active");
    tabToolbox.classList.remove("active");
    tabConsult.classList.remove("active");

    appointmentSection.classList.add("hidden");
    surgerySection.classList.add("hidden");
    toolboxSection.classList.add("hidden");
    consultSection.classList.add("hidden");

    if (name === "appointment") { tabAppointment.classList.add("active"); appointmentSection.classList.remove("hidden"); }
    if (name === "surgery") { tabSurgery.classList.add("active"); surgerySection.classList.remove("hidden"); }
    if (name === "toolbox") { tabToolbox.classList.add("active"); toolboxSection.classList.remove("hidden"); }
    if (name === "consult") { tabConsult.classList.add("active"); consultSection.classList.remove("hidden"); }
  }

  tabAppointment.onclick = () => setActiveTab("appointment");
  tabSurgery.onclick = () => setActiveTab("surgery");
  tabToolbox.onclick = () => setActiveTab("toolbox");
  tabConsult.onclick = () => setActiveTab("consult");

  setActiveTab("surgery");

  // Surgery simple/advanced
  const surgerySimpleToggle = document.getElementById("surgerySimpleToggle");
  const surgeryAdvancedToggle = document.getElementById("surgeryAdvancedToggle");
  const surgerySimplePanel = document.getElementById("surgerySimplePanel");
  const surgeryAdvancedPanel = document.getElementById("surgeryAdvancedPanel");

  function setSurgeryMode(mode) {
    if (mode === "simple") {
      surgerySimpleToggle.classList.add("active");
      surgeryAdvancedToggle.classList.remove("active");
      surgerySimplePanel.classList.remove("hidden");
      surgeryAdvancedPanel.classList.add("hidden");
    } else {
      surgerySimpleToggle.classList.remove("active");
      surgeryAdvancedToggle.classList.add("active");
      surgerySimplePanel.classList.add("hidden");
      surgeryAdvancedPanel.classList.remove("hidden");
    }
  }
  surgerySimpleToggle.onclick = () => setSurgeryMode("simple");
  surgeryAdvancedToggle.onclick = () => setSurgeryMode("advanced");
  setSurgeryMode("simple");

  // Payload functions
  const appointmentReason = document.getElementById("appointmentReason");
  const appointmentHistory = document.getElementById("appointmentHistory");
  const appointmentPe = document.getElementById("appointmentPe");
  const appointmentDiagnostics = document.getElementById("appointmentDiagnostics");
  const appointmentAssessment = document.getElementById("appointmentAssessment");
  const appointmentPlan = document.getElementById("appointmentPlan");
  const appointmentMeds = document.getElementById("appointmentMeds");

  const surgerySimpleNotes = document.getElementById("surgerySimpleNotes");
  const surgeryTemplate = document.getElementById("surgeryTemplate");
  const surgerySignalment = document.getElementById("surgerySignalment");
  const surgeryIvFluids = document.getElementById("surgeryIvFluids");
  const surgeryDrugs = document.getElementById("surgeryDrugs");
  const surgeryProcedure = document.getElementById("surgeryProcedure");
  const surgeryRecovery = document.getElementById("surgeryRecovery");
  const surgeryMeds = document.getElementById("surgeryMeds");

  const toolboxText = document.getElementById("toolboxText");
  const consultText = document.getElementById("consultText");

  function buildAppointmentPayload() {
    return {
      mode: "appointment",
      reason: appointmentReason.value,
      history: appointmentHistory.value,
      pe: appointmentPe.value,
      diagnostics: appointmentDiagnostics.value,
      assessment: appointmentAssessment.value,
      plan: appointmentPlan.value,
      meds: appointmentMeds.value
    };
  }

  function buildSurgeryPayload() {
    if (!surgeryAdvancedPanel.classList.contains("hidden")) {
      return {
        mode: "surgery",
        surgeryMode: "advanced",
        template: surgeryTemplate.value,
        signalment: surgerySignalment.value,
        ivFluids: surgeryIvFluids.value,
        drugs: surgeryDrugs.value,
        procedure: surgeryProcedure.value,
        recovery: surgeryRecovery.value,
        meds: surgeryMeds.value
      };
    }
    return {
      mode: "surgery",
      surgeryMode: "simple",
      notes: surgerySimpleNotes.value
    };
  }

  function buildToolboxPayload() {
    return { mode: "toolbox", text: toolboxText.value };
  }

  function buildConsultPayload() {
    return { mode: "consult", text: consultText.value };
  }

  async function callApi(payload) {
    const strictOrHelp = modeSelect.value || "help_me";

    statusMessage.textContent = "Working...";
    soapOutput.value = "";

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strictOrHelp, ...payload })
      });

      const data = await response.json();
      if (!data.ok) {
        statusMessage.textContent = `Error: ${data.error}`;
        return;
      }

      soapOutput.value = data.result;
      statusMessage.textContent = "Done.";
    } catch (err) {
      statusMessage.textContent = "Backend error.";
    }
  }

  document.getElementById("generateAppointmentBtn").onclick = () =>
    callApi(buildAppointmentPayload());

  document.getElementById("generateSurgeryBtn").onclick = () =>
    callApi(buildSurgeryPayload());

  document.getElementById("generateToolboxBtn").onclick = () =>
    callApi(buildToolboxPayload());

  document.getElementById("generateConsultBtn").onclick = () =>
    callApi(buildConsultPayload());

  document.getElementById("copyFullSoapBtn").onclick = async () => {
    await navigator.clipboard.writeText(soapOutput.value || "");
    statusMessage.textContent = "Copied!";
  };
})();