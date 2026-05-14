// ─────────────────────────────────────────────────────────────
// Pawtré Studio — Order Fulfillment Function
// Listens for Stripe checkout.session.completed webhooks
// and creates an order in Prodigi's print network.
// ─────────────────────────────────────────────────────────────

const Stripe = require('stripe');

// ── Prodigi product SKUs ──
const FRAMED_PRINT_SKU = "GLOBAL-BOX-12X16";        // 12×16" Boxed Frame
const CANVAS_SKU       = "GLOBAL-SLIMCAN-20X24";    // 20×24" Slim Canvas

// ── Frame colour mapping (website name → Prodigi attribute) ──
const FRAME_COLOR_MAP = {
  "Classic Black": "black",
  "Pure White":    "white",
  "Natural Oak":   "natural",
  // legacy fallbacks
  "Matte Black":   "black",
  "Antique White": "white",
  "Gold Leaf":     "natural"
};

exports.handler = async function (event) {
  // ── Read config ──
  const useSandbox = (process.env.PRODIGI_SANDBOX || "true").toLowerCase() === "true";
  const PRODIGI_API_BASE = useSandbox
    ? "https://api.sandbox.prodigi.com/v4.0"
    : "https://api.prodigi.com/v4.0";

  const PRODIGI_API_KEY       = process.env.PRODIGI_API_KEY;
  const STRIPE_SECRET         = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET || !STRIPE_WEBHOOK_SECRET) {
    console.error("Missing Stripe env vars");
    return { statusCode: 500, body: "Missing Stripe config" };
  }

  const stripe = Stripe(STRIPE_SECRET);

  // ── Verify the webhook is genuinely from Stripe ──
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // We only care about completed checkouts
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: JSON.stringify({ ignored: stripeEvent.type }) };
  }

  // ── Pull the full session with customer + line items ──
  const session = await stripe.checkout.sessions.retrieve(stripeEvent.data.object.id, {
    expand: ['customer_details']
  });

  const meta        = session.metadata || {};
  const portraitUrl = meta.portrait_url;
  const productType = meta.product_type || "framed";
  const frameColor  = meta.frame_color  || "Classic Black";

  if (productType === "digital") {
    console.log("Digital order — no Prodigi fulfilment needed.");
    return { statusCode: 200, body: JSON.stringify({ success: true, productType: "digital" }) };
  }

  if (!portraitUrl || portraitUrl === "pending") {
    console.error("No portrait URL found in metadata.");
    return { statusCode: 400, body: "Missing portrait URL" };
  }

  // ── Build the Prodigi order payload ──
  const addr = session.customer_details?.address || {};
  const recipient = {
    name:  session.customer_details?.name  || "Customer",
    email: session.customer_details?.email || "",
    address: {
      line1:           addr.line1       || "",
      line2:           addr.line2       || "",
      townOrCity:      addr.city        || "",
      postalOrZipCode: addr.postal_code || "",
      stateOrCounty:   addr.state       || "",
      countryCode:     addr.country     || "AU"
    }
  };

  const sku = productType === "canvas" ? CANVAS_SKU : FRAMED_PRINT_SKU;

  const item = {
    merchantReference: session.id,
    sku: sku,
    copies: 1,
    sizing: "fillPrintArea",
    assets: [{ printArea: "default", url: portraitUrl }]
  };

  // Frame color attribute only applies to the framed product
  if (productType === "framed") {
    item.attributes = {
      color: FRAME_COLOR_MAP[frameColor] || "black"
    };
  }

  const order = {
    shippingMethod: "Standard",
    recipient: recipient,
    items: [item],
    metadata: {
      stripeSessionId: session.id,
      mode: useSandbox ? "sandbox" : "live"
    }
  };

  console.log(`Order payload built for ${productType} (${useSandbox ? "SANDBOX" : "LIVE"}):`);
  console.log(JSON.stringify(order, null, 2));

  // ── If no Prodigi key yet, run as a dry run (log only) ──
  if (!PRODIGI_API_KEY) {
    console.log("PRODIGI_API_KEY not set — running in DRY RUN mode. Order NOT submitted.");
    return { statusCode: 200, body: JSON.stringify({ success: true, dryRun: true, order }) };
  }

  // ── Otherwise, actually submit to Prodigi ──
  try {
    const resp = await fetch(`${PRODIGI_API_BASE}/Orders`, {
      method: "POST",
      headers: {
        "X-API-Key": PRODIGI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(order)
    });

    const text = await resp.text();

    if (!resp.ok) {
      console.error("Prodigi rejected order:", resp.status, text);
      return { statusCode: 500, body: `Prodigi error ${resp.status}: ${text}` };
    }

    const result = JSON.parse(text);
    const prodigiOrderId = result.order?.id;
    console.log("✓ Prodigi order created:", prodigiOrderId);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, prodigiOrderId })
    };

  } catch (err) {
    console.error("Failed to call Prodigi:", err);
    return { statusCode: 500, body: err.message };
  }
};
