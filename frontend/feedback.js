function setFeedbackStatus(msg) {
  const el = document.getElementById("feedbackStatus");
  if (el) el.textContent = msg;
}

document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("sendFeedbackBtn");
  const textBox = document.getElementById("feedbackText");
  const contactBox = document.getElementById("feedbackContact");
  if (!sendBtn || !textBox) return;

  sendBtn.addEventListener("click", async () => {
    try {
      if (!textBox.value.trim()) {
        setFeedbackStatus("Please enter some feedback first.");
        return;
      }

      sendBtn.disabled = true;
      setFeedbackStatus("Sending feedback...");

      const res = await fetch("/.netlify/functions/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textBox.value || "",
          contact: contactBox ? contactBox.value || "" : "",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Feedback error");
      }

      setFeedbackStatus("Thank you! Feedback sent.");
      textBox.value = "";
      if (contactBox) contactBox.value = "";
    } catch (err) {
      console.error(err);
      setFeedbackStatus("Could not send feedback.");
    } finally {
      sendBtn.disabled = false;
    }
  });
});