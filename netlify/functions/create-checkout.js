// ─────────────────────────────────────────────
// Pawtré Studio — Stripe Checkout Function
// Netlify Serverless Function
// ─────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event) {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items, customerEmail, portraitUrl } = JSON.parse(event.body);

    // ── Build line items from what the customer selected ──
    const lineItemMap = {
      digital: {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Pawtré Studio — Digital Portrait',
            description: 'High-resolution 4K digital file. Instant delivery via email.',
            images: ['https://pawtrestudio.com/pet_puppy.png'],
          },
          unit_amount: 1900, // $19.00 in cents
        },
        quantity: 1,
      },
      framed: {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Pawtré Studio — Printed & Framed Portrait',
            description: 'Premium giclée print 12×16", choice of frame, ships in 5–7 days. Digital file included.',
            images: ['https://pawtrestudio.com/pet_puppy.png'],
          },
          unit_amount: 8900, // $89.00 in cents
        },
        quantity: 1,
      },
      canvas: {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Pawtré Studio — Grand Canvas Portrait',
            description: 'Gallery canvas 20×24", hand-stretched, varnished finish. Certificate of authenticity included.',
            images: ['https://pawtrestudio.com/pet_puppy.png'],
          },
          unit_amount: 14900, // $149.00 in cents
        },
        quantity: 1,
      },
      goldframe: {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'Gold Leaf Frame Upgrade',
            description: 'Upgrade your frame to a premium gold leaf finish.',
          },
          unit_amount: 2000, // $20.00 in cents
        },
        quantity: 1,
      },
    };

    // Build the line items array from what was selected
    const selectedLineItems = items
      .map(item => lineItemMap[item])
      .filter(Boolean);

    if (selectedLineItems.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No valid items selected' })
      };
    }

    // ── Create Stripe Checkout Session ──
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: selectedLineItems,
      mode: 'payment',
      
      // Where to send customer after payment
      success_url: `https://pawtrestudio.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://pawtrestudio.com/#studio`,

      // Pre-fill customer email if we have it
      customer_email: customerEmail || undefined,

      // Collect shipping address for physical products
      shipping_address_collection: {
        allowed_countries: ['AU', 'US', 'GB', 'CA', 'NZ', 'SG'],
      },

      // Shipping options
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

      // Store the portrait URL in metadata so you can access it after payment
      metadata: {
        portrait_url: portraitUrl || 'pending',
        studio: 'pawtre-studio'
      },

      // Nice branding on the checkout page
      custom_text: {
        submit: {
          message: 'Your royal portrait will be prepared and shipped with care. ✦'
        }
      },

      // Allow promo codes
      allow_promotion_codes: true,
    });

    // Return the checkout URL to redirect the customer
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        url: session.url,         // Redirect customer here
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
