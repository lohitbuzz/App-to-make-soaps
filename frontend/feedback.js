const feedbackText = document.getElementById("feedbackText");
const feedbackContact = document.getElementById("feedbackContact");
const sendFeedbackBtn = document.getElementById("sendFeedbackBtn");
const feedbackStatus = document.getElementById("feedbackStatus");

async function postFeedback() {
  if (!feedbackText || !feedbackStatus) return;

  const text = feedbackText.value.trim();
  if (!text) {
    feedbackStatus.textContent = "Please add some feedback first.";
    return;
  }

  feedbackStatus.textContent = "Sending feedback…";

  try {
    const res = await fetch("/.netlify/functions/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "app-feedback",
        feedback: text,
        contact: (feedbackContact && feedbackContact.value) || "",
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    await res.json().catch(() => ({}));

    feedbackStatus.textContent = "Thank you! Feedback sent.";
    feedbackText.value = "";
  } catch (err) {
    console.error(err);
    feedbackStatus.textContent = "Error sending feedback. Please try again later.";
  }
}

if (sendFeedbackBtn) {
  sendFeedbackBtn.addEventListener("click", postFeedback);
}
