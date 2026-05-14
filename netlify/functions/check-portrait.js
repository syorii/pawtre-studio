// ─────────────────────────────────────────────
// Pawtré Studio — Portrait Status Poller
// Proxies fal.ai queue status & response URLs
// so the browser can poll without exposing
// the API key.
// ─────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { url } = JSON.parse(event.body || "{}");

    // Security: only allow URLs from fal.ai's queue domain
    if (!url || !url.startsWith("https://queue.fal.run/")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid or missing URL" })
      };
    }

    const resp = await fetch(url, {
      headers: {
        "Authorization": `Key ${process.env.FAL_API_KEY}`,
        "Accept": "application/json"
      }
    });

    const text = await resp.text();

    return {
      statusCode: resp.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: text
    };

  } catch (error) {
    console.error("Check-portrait error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Status check failed.", message: error.message })
    };
  }
};
