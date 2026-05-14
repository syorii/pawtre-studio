// ─────────────────────────────────────────────
// Pawtré Studio — Stripe Checkout Function
// ─────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event) {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items, customerEmail, portraitUrl, frameColor } = JSON.parse(event.body);

    // ── Product catalogue (matches Prodigi SKUs in fulfill-order.js) ──
    const lineItemMap = {
      digital: {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Pawtré Studio — Digital Portrait',
            description: 'High-resolution 4K digital file. Instant delivery via email.',
            images: ['https://pawtrestudio.com/pet_puppy.png'],
          },
          unit_amount: 1900,
        },
        quantity: 1,
      },
      framed: {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Pawtré Studio — Framed Portrait 12×16"',
            description: 'Premium giclée print in your choice of frame. Ships in 5–7 days. Digital file included.',
            images: ['https://pawtrestudio.com/pet_puppy.png'],
          },
          unit_amount: 8900,
        },
        quantity: 1,
      },
      canvas: {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Pawtré Studio — Gallery Canvas 20×24"',
            description: 'Hand-stretched canvas with varnished finish. Certificate of authenticity included.',
            images: ['https://pawtrestudio.com/pet_puppy.png'],
          },
          unit_amount: 14900,
        },
        quantity: 1,
      },
    };

    const selectedLineItems = items
      .map(item => lineItemMap[item])
      .filter(Boolean);

    if (selectedLineItems.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No valid items selected' })
      };
    }

    // ── Determine the primary product for Prodigi fulfilment ──
    let productType = "framed";
    if (items.includes("canvas")) productType = "canvas";
    else if (items.includes("digital") && !items.includes("framed")) productType = "digital";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: selectedLineItems,
      mode: 'payment',
      success_url: `https://pawtrestudio.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://pawtrestudio.com/#studio`,

      customer_email: customerEmail || undefined,

      shipping_address_collection: {
        allowed_countries: ['AU', 'US', 'GB', 'CA', 'NZ', 'SG'],
      },

      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'aud' },
            display_name: 'Standard shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 2500, currency: 'aud' },
            display_name: 'Express shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 1 },
              maximum: { unit: 'business_day', value: 2 },
            },
          },
        },
      ],

      // Metadata gets passed to fulfill-order.js for Prodigi
      metadata: {
        portrait_url: portraitUrl || 'pending',
        product_type: productType,
        frame_color:  frameColor || 'Classic Black',
        studio:       'pawtre-studio'
      },

      custom_text: {
        submit: {
          message: 'Your royal portrait will be prepared and shipped with care. ✦'
        }
      },

      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        url: session.url,
        sessionId: session.id
      })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Payment setup failed. Please try again.',
        message: error.message
      })
    };
  }
};
