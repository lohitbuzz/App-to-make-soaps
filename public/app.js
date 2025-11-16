function showTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.style.display = "none");
  document.getElementById(tab).style.display = "block";
}

async function generateSOAP() {
  const response = await fetch("/api/generate-soap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseLabel: document.getElementById("caseLabel").value,
      type: document.getElementById("soapType").value,
      template: document.getElementById("soapTemplate").value,
      reason: document.getElementById("reason").value,
      plan: document.getElementById("planInput").value
    })
  });

  const data = await response.json();

  document.getElementById("oSubjective").innerText = data.subjective;
  document.getElementById("oObjective").innerText = data.objective;
  document.getElementById("oAssessment").innerText = data.assessment;
  document.getElementById("oPlan").innerText = data.plan;
  document.getElementById("oMeds").innerText = data.meds;
  document.getElementById("oAftercare").innerText = data.aftercare;
}

async function processToolbox() {
  const response = await fetch("/api/toolbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: document.getElementById("toolboxInput").value
    })
  });

  const data = await response.json();
  document.getElementById("toolboxOutput").innerText = data.result;
}

async function sendFeedback() {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: document.getElementById("feedbackType").value,
      text: document.getElementById("feedbackText").value
    })
  });

  const data = await response.json();
  document.getElementById("feedbackStatus").innerText = data.status;
}