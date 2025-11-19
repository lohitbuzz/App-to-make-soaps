const BACKEND_URL = "https://lohit-soap-app.onrender.com/api/soap";

(function () {
  const feedbackInput = document.getElementById("feedbackInput");
  const feedbackOutput = document.getElementById("feedbackOutput");
  const feedbackMode = document.getElementById("feedbackMode");
  const sendBtn = document.getElementById("sendFeedbackBtn");

  async function sendFeedback() {
    const text = feedbackInput.value.trim();
    if (!text) return;

    feedbackOutput.value = "Working...";

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "feedback",
          text,
          strictOrHelp: feedbackMode.value
        })
      });

      const data = await response.json();
      feedbackOutput.value = data.result || "No response.";
    } catch (err) {
      feedbackOutput.value = "Backend error.";
    }
  }

  sendBtn.onclick = sendFeedback;
})();
