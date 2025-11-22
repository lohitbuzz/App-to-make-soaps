// netlify/functions/soap.js
exports.handler = async (event, context) => {
  const body = JSON.parse(event.body || "{}");

  if (body.mode === "ping") {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  }

  // TODO: call OpenAI / your assistant here, then:
  return {
    statusCode: 200,
    body: JSON.stringify({
      mainText: "Stub response from soap.js – wire OpenAI here.",
      toolboxText: "",
      consultText: ""
    })
  };
};
