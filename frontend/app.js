// ================================
// Moksha SOAP – Frontend UI Logic
// ================================

document.addEventListener("DOMContentLoaded", () => {
  // -----------------------------
  // TOP TABS: SOAP · Toolbox · Consult
  // -----------------------------
  const tabs = [
    { button: "tab-soap", panel: "panel-soap" },
    { button: "tab-toolbox", panel: "panel-toolbox" },
    { button: "tab-consult", panel: "panel-consult" }
  ];

  function activateTab(targetButton, targetPanel) {
    tabs.forEach(({ button, panel }) => {
      const btn = document.getElementById(button);
      const pnl = document.getElementById(panel);

      if (btn) btn.classList.remove("active");
      if (pnl) pnl.style.display = "none";
    });

    const activeBtn = document.getElementById(targetButton);
    const activePanel = document.getElementById(targetPanel);

    if (activeBtn) activeBtn.classList.add("active");
    if (activePanel) activePanel.style.display = "block";
  }

  // Attach listeners
  tabs.forEach(({ button, panel }) => {
    const btn = document.getElementById(button);
    if (btn) {
      btn.addEventListener("click", () => activateTab(button, panel));
    }
  });

  // Default = SOAP tab
  activateTab("tab-soap", "panel-soap");

  // -----------------------------
  // SOAP MODE: Appointment ↔ Surgery
  // -----------------------------
  const btnAppt = document.getElementById("visit-appointment");
  const btnSurg = document.getElementById("visit-surgery");

  const blockAppt = document.getElementById("appointment-fields");
  const blockSurg = document.getElementById("surgery-fields");
  const blockSurgMode = document.getElementById("surgery-mode-row");

  function setVisitMode(mode) {
    const isSurgery = mode === "surgery";

    if (btnAppt) btnAppt.classList.toggle("active", !isSurgery);
    if (btnSurg) btnSurg.classList.toggle("active", isSurgery);

    if (blockAppt) blockAppt.style.display = isSurgery ? "none" : "block";
    if (blockSurg) blockSurg.style.display = isSurgery ? "block" : "none";
    if (blockSurgMode) blockSurgMode.style.display = isSurgery ? "flex" : "none";
  }

  if (btnAppt) btnAppt.addEventListener("click", () => setVisitMode("appointment"));
  if (btnSurg) btnSurg.addEventListener("click", () => setVisitMode("surgery"));

  // Default = appointment
  setVisitMode("appointment");

  // -----------------------------
  // SURGERY SIMPLE ↔ ADVANCED
  // -----------------------------
  const btnSimple = document.getElementById("surgery-simple");
  const btnAdvanced = document.getElementById("surgery-advanced");

  const fieldsSimple = document.getElementById("surgery-simple-fields");
  const fieldsAdvanced = document.getElementById("surgery-advanced-fields");

  function setSurgeryMode(mode) {
    const isAdv = mode === "advanced";

    if (btnSimple) btnSimple.classList.toggle("active", !isAdv);
    if (btnAdvanced) btnAdvanced.classList.toggle("active", isAdv);

    if (fieldsSimple) fieldsSimple.style.display = isAdv ? "none" : "block";
    if (fieldsAdvanced) fieldsAdvanced.style.display = isAdv ? "block" : "none";
  }

  if (btnSimple) btnSimple.addEventListener("click", () => setSurgeryMode("simple"));
  if (btnAdvanced) btnAdvanced.addEventListener("click", () => setSurgeryMode("advanced"));

  // Default = simple surgery mode
  setSurgeryMode("simple");

  // -----------------------------
  // BACKEND STATUS INDICATOR
  // -----------------------------
  const backendLight = document.getElementById("backend-status-light");
  async function pingBackend() {
    try {
      const res = await fetch("/api/ping");
      if (res.ok) backendLight?.classList.add("online");
    } catch {
      backendLight?.classList.remove("online");
    }
  }
  pingBackend();

  // -----------------------------
  // GENERATE SOAP BUTTON BINDING
  // (This DOES NOT modify your backend logic)
  // -----------------------------
  const genBtn = document.getElementById("generate-soap-btn");
  const outputBox = document.getElementById("soap-output-box");

  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      outputBox.textContent = "Generating…";

      try {
        const res = await fetch("https://lohit-soap-app.onrender.com/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: collectFormInputs() })
        });

        const data = await res.json();
        outputBox.textContent = data.output || "[No output received]";
      } catch (err) {
        outputBox.textContent = "Backend unreachable";
      }
    });
  }

  // Dummy getter — replace with your real logic
  function collectFormInputs() {
    return { test: true };
  }
});