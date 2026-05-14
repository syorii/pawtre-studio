// ─────────────────────────────────────────────────────────────
// Pawtré Studio — Portrait Generation
// Netlify Serverless Function · fal.ai Flux Pro Kontext
//
// Design goals:
//   1. Pet identity is preserved (Kontext is built for this).
//   2. Lighting, angle, composition are LOCKED per style — every
//      run of the same style produces a visually consistent piece.
//   3. Output is high-resolution and print-ready (3:4, 30 steps).
//   4. Style + props compose cleanly without prompt conflict.
// ─────────────────────────────────────────────────────────────

const FAL_MODEL = "fal-ai/flux-pro/kontext";

// ── Shared composition rules applied to EVERY style ──
// These keep angle, framing, eye-line, and pose locked so all
// five styles read like a curated collection.
const COMPOSITION_LOCK = [
  "head-and-shoulders bust portrait",
  "three-quarter angle facing slightly to viewer's left",
  "subject perfectly centered in frame",
  "eyes in the upper third of the composition",
  "soft direct eye contact with the viewer",
  "shoulders visible at the bottom edge",
  "preserve the pet's exact breed, fur color, fur pattern, eye color, and facial markings",
  "single pet only, no other animals, no human hands or people",
  "no text, no signatures, no watermarks, no borders, no frames within the image"
].join(", ");

const QUALITY_LOCK = [
  "museum-quality fine art",
  "ultra-detailed",
  "sharp focus on the eyes",
  "high dynamic range",
  "print-ready resolution",
  "professional artwork"
].join(", ");

// ── Per-style "look book" ──
// Each entry specifies lighting, palette, surface, mood and a fixed
// seed so the style stays consistent run-to-run.
const STYLES = {
  renaissance: {
    label: "Renaissance Royal",
    seed: 1492,
    prompt: [
      "Transform this pet into a 15th–16th century Italian Renaissance oil portrait in the tradition of Titian and Bronzino.",
      "Subject wears rich crimson and deep emerald velvet robes with intricate gold-thread embroidery and a starched white linen collar.",
      "Background: a softly out-of-focus dark burgundy velvet drapery with the faintest hint of a carved wooden architectural frame in deep shadow.",
      "Lighting: Rembrandt chiaroscuro — a single warm candlelight key light from the upper left at a 45-degree angle, deep umber shadows on the right side of the face, gentle catchlight in the eyes.",
      "Surface: oil on aged wooden panel, visible fine craquelure, subtle glaze layers, antique varnish glow, warm amber tonal palette dominated by burgundy, ochre, ivory and gold leaf accents.",
      "Mood: dignified, sober, regal, contemplative — the pet as 15th-century nobility."
    ].join(" ")
  },

  oil: {
    label: "Regal Oil",
    seed: 1788,
    prompt: [
      "Transform this pet into a formal 18th-century British aristocratic oil portrait in the style of Gainsborough and Reynolds.",
      "Subject sits in a dignified upright pose wearing a deep navy or forest-green velvet coat with brass buttons and a soft cream cravat.",
      "Background: a nearly black void with a subtle warm-brown gradient suggesting depth, a hint of stormy sky in the far upper right.",
      "Lighting: dramatic Flemish-style single light source from the upper left, strong specular highlights on the brow and cheekbone, deep velvety shadows, theatrical falloff into the background.",
      "Surface: oil on linen canvas, visible confident brushwork, loose painterly impasto in the highlights, restrained palette of dark earth tones with occasional jewel-tone accents.",
      "Mood: solemn, dignified, Old Master gravitas — the pet as English landed gentry."
    ].join(" ")
  },

  modern: {
    label: "Modern Minimal",
    seed: 2025,
    prompt: [
      "Transform this pet into a contemporary editorial minimalist portrait illustration in the spirit of a modern art gallery poster.",
      "Subject is rendered with clean, simplified shapes and confident graphic lines, the breed and features instantly readable but stylised with restraint.",
      "Background: a single flat solid color — warm cream or muted dusty terracotta — with generous negative space surrounding the subject.",
      "Lighting: flat, soft, even ambient light — no harsh shadows, gentle form modeling only, Bauhaus-clean.",
      "Surface: matte flat-vector aesthetic with the faintest paper grain, limited palette of three to four harmonious muted tones, crisp edges and quiet sophistication.",
      "Mood: calm, contemporary, considered, Scandinavian — the pet as a gallery-worthy editorial illustration."
    ].join(" ")
  },

  watercolour: {
    label: "Watercolour Whimsy",
    seed: 1856,
    prompt: [
      "Transform this pet into a luminous fine-art watercolour portrait in the tradition of contemporary botanical and storybook illustration.",
      "Subject is painted with delicate wet-on-wet pastel washes — soft blush pinks, sage greens, dusty lavender and warm honey tones — with crisp dry-brush detail kept for the eyes, nose and a few defining fur strands.",
      "Background: a wash of soft cream watercolour paper with delicate scattered floral motifs — pale peonies, eucalyptus leaves and tiny wildflowers — fading gently outward.",
      "Lighting: soft diffuse natural daylight from a large window, gentle even modeling, luminous quality as if light is passing through the paper.",
      "Surface: textured cold-press cotton watercolour paper, visible paper grain, bleeding pigment edges, occasional water bloom and granulation, transparent layered washes.",
      "Mood: dreamy, gentle, joyful, enchanting — the pet as a beloved storybook hero."
    ].join(" ")
  },

  cosmic: {
    label: "Cosmic Royalty",
    seed: 42,
    prompt: [
      "Transform this pet into a cinematic celestial cosmic portrait — a divine inter-dimensional ruler.",
      "Subject wears flowing celestial robes woven from starlight and nebula, with a delicate crown of constellations resting above their head.",
      "Background: a deep-space nebula in rich royal purple, indigo and magenta with thousands of pinpoint stars, a soft galactic spiral receding into the distance.",
      "Lighting: dramatic rim light in iridescent cyan and magenta from behind the subject, gentle warm front fill, a glowing aura of stardust particles drifting upward, sparkling reflections in the eyes.",
      "Surface: hyper-detailed cinematic digital painting, smooth painterly gradients, subtle volumetric atmosphere, iridescent highlights, deep saturated jewel tones.",
      "Mood: divine, otherworldly, sovereign, awe-inspiring — the pet as cosmic deity."
    ].join(" ")
  }
};

// ── Props — woven into the prompt so they layer cleanly on top
// of the style without breaking composition.
const PROPS = {
  crown:    "wearing an ornate jewelled golden crown sitting elegantly on their head",
  tophat:   "wearing a tall classic black silk top hat tilted at a rakish angle",
  jewels:   "adorned with a heavy gemstone collar featuring rubies, sapphires and pearls",
  cape:     "draped in a long flowing velvet cape with ermine fur trim across the shoulders",
  flowers:  "with a delicate floral garland of roses and wildflowers around the neckline",
  sword:    "with a decorative ceremonial sword resting against the shoulder, hilt visible",
  bowtie:   "wearing a perfectly tied silk bow tie at the collar",
  scroll:   "with a partially-unfurled ancient royal scroll bearing a wax seal visible at the bottom edge"
};

// ── Build the final prompt for a given style + props ──
function buildPrompt(styleKey, propsList = []) {
  const style = STYLES[styleKey];
  if (!style) throw new Error(`Unknown style: ${styleKey}`);

  const propPhrases = (propsList || [])
    .map(p => PROPS[p])
    .filter(Boolean);
  const propText = propPhrases.length
    ? ` The subject is ${propPhrases.join(", and is also ")}.`
    : "";

  return [
    style.prompt,
    propText,
    `Composition: ${COMPOSITION_LOCK}.`,
    `Quality: ${QUALITY_LOCK}.`
  ].join(" ");
}

// ── Main handler ──
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { imageBase64, style, props, seedOverride } = JSON.parse(event.body || "{}");

    if (!imageBase64 || !style) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing image or style" })
      };
    }

    if (!STYLES[style]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Unknown style "${style}"` })
      };
    }

    const prompt = buildPrompt(style, props);
    const seed = typeof seedOverride === "number" ? seedOverride : STYLES[style].seed;

    const falResponse = await fetch(`https://fal.run/${FAL_MODEL}`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${process.env.FAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: imageBase64,
        prompt: prompt,
        aspect_ratio: "3:4",
        guidance_scale: 3.5,
        num_inference_steps: 30,
        seed: seed,
        output_format: "jpeg",
        safety_tolerance: "2"
      })
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error("fal.ai error:", errorText);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Image generation failed. Please try again.",
          details: errorText
        })
      };
    }

    const falData = await falResponse.json();
    const generatedImageUrl = falData.images?.[0]?.url;

    if (!generatedImageUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No image returned. Please try again." })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        imageUrl: generatedImageUrl,
        style: style,
        styleLabel: STYLES[style].label,
        seed: seed
      })
    };

  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Something went wrong. Please try again.",
        message: error.message
      })
    };
  }
};

// Export internals so the sample-generation script can reuse them.
module.exports.STYLES = STYLES;
module.exports.PROPS = PROPS;
module.exports.buildPrompt = buildPrompt;
module.exports.FAL_MODEL = FAL_MODEL;
