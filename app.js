"use strict";

// ---------- TAB SWITCHING ----------
(function () {
  var tabs = document.querySelectorAll(".tab");
  var panels = {
    appointment: document.getElementById("tab-appointment"),
    surgery: document.getElementById("tab-surgery"),
    freeform: document.getElementById("tab-freeform"),
    toolbox: document.getElementById("tab-toolbox")
  };

  function showTab(name) {
    for (var key in panels) {
      if (!panels.hasOwnProperty(key)) continue;
      var panel = panels[key];
      if (!panel) continue;
      panel.style.display = key === name ? "block" : "none";
    }
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t.getAttribute("data-tab") === name) t.classList.add("active");
      else t.classList.remove("active");
    }
  }

  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function () {
      var name = this.getAttribute("data-tab");
      if (name) showTab(name);
    });
  }

  showTab("appointment");
})();

// ---------- COMMON HELPERS ----------
var statusEl = document.getElementById("queryStatus");
var lastSoapPayload = null;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function callBackend(mode, payload) {
  setStatus("Working...");
  return fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: mode, payload: payload })
  }).then(function (resp) {
    if (!resp.ok) {
      setStatus("Error from server.");
      throw new Error("Server error");
    }
    return resp.json();
  }).then(function (data) {
    setStatus("Ready.");
    return data.result || "";
  })["catch"](function (err) {
    console.error(err);
    setStatus("Error from server.");
    throw err;
  });
}

function splitSoapIntoSections(text) {
  var sections = {
    "Subjective": "",
    "Objective": "",
    "Assessment": "",
    "Plan": "",
    "Medications Dispensed": "",
    "Aftercare": ""
  };

  var current = null;
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();
    if (/^Subjective:/i.test(trimmed)) { current = "Subjective"; continue; }
    if (/^Objective:/i.test(trimmed)) { current = "Objective"; continue; }
    if (/^Assessment:/i.test(trimmed)) { current = "Assessment"; continue; }
    if (/^Plan:/i.test(trimmed)) { current = "Plan"; continue; }
    if (/^Medications Dispensed:/i.test(trimmed)) { current = "Medications Dispensed"; continue; }
    if (/^Aftercare:/i.test(trimmed)) { current = "Aftercare"; continue; }
    if (!current) continue;
    sections[current] += (sections[current] ? "\n" : "") + line;
  }
  return sections;
}

function renderSoapSections(sections) {
  var map = {
    subjectiveOutput: "Subjective",
    objectiveOutput: "Objective",
    assessmentOutput: "Assessment",
    planOutput: "Plan",
    medsOutput: "Medications Dispensed",
    aftercareOutput: "Aftercare"
  };
  for (var id in map) {
    if (!map.hasOwnProperty(id)) continue;
    var name = map[id];
    var el = document.getElementById(id);
    if (el) el.textContent = sections[name] || "";
  }
  var card = document.getElementById("soapOutputCard");
  var fb = document.getElementById("feedbackBar");
  if (card) card.style.display = "block";
  if (fb) fb.style.display = "block";
}

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)["catch"](function () { });
  }
}

// ---------- APPOINTMENT ----------
var genApptBtn = document.getElementById("generateAppointmentBtn");
if (genApptBtn) {
  genApptBtn.addEventListener("click", function () {
    var caseLabel = (document.getElementById("caseLabel").value || "").trim();
    var accuracyMode = document.getElementById("accuracyMode").value || "help";
    var strictMode = accuracyMode === "strict";

    var fields = {
      reason: document.getElementById("apptReason").value,
      tpr: document.getElementById("apptTPR").value,
      history: document.getElementById("apptHistory").value,
      physicalExam: document.getElementById("apptPE").value,
      diagnostics: document.getElementById("apptDiagnostics").value,
      assessment: document.getElementById("apptAssessment").value,
      plan: document.getElementById("apptPlan").value,
      meds: document.getElementById("apptMeds").value
    };

    var payload = {
      soapType: "appointment",
      strictMode: strictMode,
      caseLabel: caseLabel,
      fields: fields,
      refinementNote: null
    };
    lastSoapPayload = payload;

    callBackend("soap", payload).then(function (text) {
      var sections = splitSoapIntoSections(text);
      renderSoapSections(sections);
    });
  });
}

// ---------- SURGERY ----------
var genSxBtn = document.getElementById("generateSurgeryBtn");
if (genSxBtn) {
  genSxBtn.addEventListener("click", function () {
    var caseLabel = (document.getElementById("caseLabel").value || "").trim();
    var accuracyMode = document.getElementById("accuracyMode").value || "help";
    var strictMode = accuracyMode === "strict";

    var fields = {
      template: document.getElementById("sxTemplate").value,
      asa: document.getElementById("sxASA").value,
      ett: document.getElementById("sxETT").value,
      catheter: document.getElementById("sxCatheter").value,
      fluidsRate: document.getElementById("sxFluidsRate").value,
      fluidsDeclined: document.getElementById("sxFluidsDeclined").checked,
      premeds: document.getElementById("sxPremeds").value,
      induction: document.getElementById("sxInduction").value,
      intraOpMeds: document.getElementById("sxIntraOpMeds").value,
      procedureNotes: document.getElementById("sxProcedureNotes").value,
      monocryl0: document.getElementById("sxMonocryl0").checked,
      monocryl2_0: document.getElementById("sxMonocryl2_0").checked,
      monocryl3_0: document.getElementById("sxMonocryl3_0").checked,
      tpr: document.getElementById("sxTPR").value,
      durations: document.getElementById("sxDurations").value
    };

    var payload = {
      soapType: "surgery",
      strictMode: strictMode,
      caseLabel: caseLabel,
      fields: fields,
      refinementNote: null
    };
    lastSoapPayload = payload;

    callBackend("soap", payload).then(function (text) {
      var sections = splitSoapIntoSections(text);
      renderSoapSections(sections);
    });
  });
}

// ---------- REFINE ----------
var refineBtn = document.getElementById("refineBtn");
if (refineBtn) {
  refineBtn.addEventListener("click", function () {
    if (!lastSoapPayload) return;
    var note = document.getElementById("refineNote").value.trim();
    var payload = JSON.parse(JSON.stringify(lastSoapPayload));
    payload.refinementNote = note || "(no extra details provided)";
    callBackend("soap", payload).then(function (text) {
      var sections = splitSoapIntoSections(text);
      renderSoapSections(sections);
    });
  });
}

// ---------- COPY BUTTONS ----------
window.copySection = function (name) {
  var idMap = {
    "Subjective": "subjectiveOutput",
    "Objective": "objectiveOutput",
    "Assessment": "assessmentOutput",
    "Plan": "planOutput",
    "Medications Dispensed": "medsOutput",
    "Aftercare": "aftercareOutput"
  };
  var id = idMap[name];
  if (!id) return;
  var el = document.getElementById(id);
  var text = el ? el.textContent : "";
  copyToClipboard(text);
};

var copyFullBtn = document.getElementById("copyFullSoapBtn");
if (copyFullBtn) {
  copyFullBtn.addEventListener("click", function () {
    var s = document.getElementById("subjectiveOutput").textContent;
    var o = document.getElementById("objectiveOutput").textContent;
    var a = document.getElementById("assessmentOutput").textContent;
    var p = document.getElementById("planOutput").textContent;
    var m = document.getElementById("medsOutput").textContent;
    var ac = document.getElementById("aftercareOutput").textContent;
    var full = [
      "Subjective:",
      s,
      "",
      "Objective:",
      o,
      "",
      "Assessment:",
      a,
      "",
      "Plan:",
      p,
      "",
      "Medications Dispensed:",
      m,
      "",
      "Aftercare:",
      ac
    ].join("\n");
    copyToClipboard(full);
  });
}

var copyPMA = document.getElementById("copyPlanMedsAftercareBtn");
if (copyPMA) {
  copyPMA.addEventListener("click", function () {
    var p = document.getElementById("planOutput").textContent;
    var m = document.getElementById("medsOutput").textContent;
    var ac = document.getElementById("aftercareOutput").textContent;
    var combo = [
      "Plan:",
      p,
      "",
      "Medications Dispensed:",
      m,
      "",
      "Aftercare:",
      ac
    ].join("\n");
    copyToClipboard(combo);
  });
}

// ---------- CONSULT ----------
var runConsultBtn = document.getElementById("runConsultBtn");
if (runConsultBtn) {
  runConsultBtn.addEventListener("click", function () {
    var text = (document.getElementById("consultInput").value || "").trim();
    if (!text) return;
    callBackend("consult", { message: text }).then(function (out) {
      var body = document.getElementById("consultOutput");
      var sec = document.getElementById("consultOutputSection");
      if (body) body.textContent = out;
      if (sec) sec.style.display = "block";
    });
  });
}

// ---------- TOOLBOX: BLOODWORK ----------
var runBwHelperBtn = document.getElementById("runBwHelperBtn");
if (runBwHelperBtn) {
  runBwHelperBtn.addEventListener("click", function () {
    var text = (document.getElementById("bwText").value || "").trim();
    if (!text) return;
    var detailLevel = document.getElementById("bwDetail").value;
    var includeDiffs = document.getElementById("bwDiffs").checked;
    var includeClientFriendly = document.getElementById("bwClientFriendly").checked;

    callBackend("toolbox-bloodwork", {
      text: text,
      detailLevel: detailLevel,
      includeDiffs: includeDiffs,
      includeClientFriendly: includeClientFriendly
    }).then(function (out) {
      var body = document.getElementById("bwOutput");
      var sec = document.getElementById("bwOutputSection");
      if (body) body.textContent = out;
      if (sec) sec.style.display = "block";
    });
  });
}

// ---------- TOOLBOX: EMAIL ----------
var runEmailHelperBtn = document.getElementById("runEmailHelperBtn");
if (runEmailHelperBtn) {
  runEmailHelperBtn.addEventListener("click", function () {
    var payload = {
      emailType: document.getElementById("emailType").value,
      petName: document.getElementById("emailPetName").value,
      ownerName: document.getElementById("emailOwnerName").value,
      timeframe: document.getElementById("emailTimeframe").value,
      notes: document.getElementById("emailNotes").value
    };
    callBackend("toolbox-email", payload).then(function (out) {
      var body = document.getElementById("emailOutput");
      var sec = document.getElementById("emailOutputSection");
      if (body) body.textContent = out;
      if (sec) sec.style.display = "block";
    });
  });
}

// ---------- MIC BUBBLE ----------
var micBubble = document.getElementById("micBubble");
var lastFocusedElement = null;

document.addEventListener("focusin", function (e) {
  var t = e.target;
  if (!t) return;
  if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") {
    lastFocusedElement = t;
  }
});

function initMicBubble() {
  if (!micBubble) return;
  var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (isiOS || !SpeechRecognition) {
    micBubble.addEventListener("click", function () {
      alert("On iPhone/iPad, use the keyboard mic to dictate into the focused box. Browser speech recognition is not supported.");
    });
    return;
  }

  var recognition = new SpeechRecognition();
  recognition.lang = "en-CA";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  var listening = false;

  recognition.addEventListener("result", function (event) {
    var transcript = event.results[0][0].transcript;
    if (!lastFocusedElement) return;
    var el = lastFocusedElement;
    var start = el.selectionStart || el.value.length;
    var end = el.selectionEnd || el.value.length;
    var before = el.value.slice(0, start);
    var after = el.value.slice(end);
    el.value = before + (before ? " " : "") + transcript + (after ? " " + after : "");
  });

  recognition.addEventListener("end", function () {
    listening = false;
    micBubble.classList.remove("listening");
  });

  micBubble.addEventListener("click", function () {
    if (listening) {
      recognition.stop();
      return;
    }
    listening = true;
    micBubble.classList.add("listening");
    recognition.start();
  });
}

initMicBubble();