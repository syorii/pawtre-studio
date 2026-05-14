// ─────────────────────────────────────────────────────────────
// Pawtré Studio — Portrait Generation (Queue Pattern)
// Submits to fal.ai's queue, returns immediately with IDs.
// The frontend then polls /check-portrait for the result.
// ─────────────────────────────────────────────────────────────

const FAL_MODEL = "fal-ai/flux-pro/kontext";

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
      "Subject sits in a dignified upright pose wearing a deep navy
