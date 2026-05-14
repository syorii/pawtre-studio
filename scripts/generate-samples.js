#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Pawtré Studio — Sample Image Generator
//
// Generates one consistent sample portrait for each of the five
// signature styles, using a single reference pet photo. Re-uses
// the exact same prompts, seeds, model and aspect ratio as the
// live site generator (netlify/functions/generate-portrait.js)
// so the gallery shows EXACTLY what customers will receive.
//
// Usage:
//   1. Drop a clear, well-lit reference pet photo at
//      scripts/reference-pet.jpg  (or .png — see REFERENCE below)
//   2. Set your fal.ai key:
//        PowerShell:  $env:FAL_API_KEY = "your-key-here"
//        bash/zsh:    export FAL_API_KEY="your-key-here"
//   3. Run from the project root:
//        node scripts/generate-samples.js
//        node scripts/generate-samples.js renaissance    # one style
//        node scripts/generate-samples.js --hero         # also re-render hero crops
//
// Outputs JPEGs to:  samples/<style-key>.jpg
//
// Requires Node 18+ (built-in fetch).
// ─────────────────────────────────────────────────────────────

const fs   = require("fs");
const path = require("path");

const {
  STYLES,
  buildPrompt,
  FAL_MODEL
} = require("../netlify/functions/generate-portrait.js");

// ── Config ──
const REFERENCE_CANDIDATES = [
  "scripts/reference-pet.jpg",
  "scripts/reference-pet.jpeg",
  "scripts/reference-pet.png",
  "scripts/reference-pet.webp"
];
const OUTPUT_DIR = path.join(process.cwd(), "samples");
const FAL_KEY    = process.env.FAL_API_KEY;

// ── Tiny logger ──
const log = {
  info:  (m) => console.log(`  ${m}`),
  step:  (m) => console.log(`\n→ ${m}`),
  done:  (m) => console.log(`✓ ${m}`),
  fail:  (m) => console.error(`✗ ${m}`),
  title: (m) => console.log(`\n━━━ ${m} ━━━`)
};

// ── Helpers ──
function findReference() {
  for (const rel of REFERENCE_CANDIDATES) {
    const abs = path.join(process.cwd(), rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function toDataUrl(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "jpeg" : ext;
  const buf  = fs.readFileSync(filePath);
  return `data:image/${mime};base64,${buf.toString("base64")}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function generateOne(styleKey, imageDataUrl) {
  const style  = STYLES[styleKey];
  const prompt = buildPrompt(styleKey, []);

  log.step(`${style.label}  (seed ${style.seed})`);

  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image_url: imageDataUrl,
      prompt: prompt,
      aspect_ratio: "3:4",
      guidance_scale: 3.5,
      num_inference_steps: 30,
      seed: style.seed,
      output_format: "jpeg",
      safety_tolerance: "2"
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai ${res.status}: ${text}`);
  }

  const data = await res.json();
  const url  = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned");

  const outPath = path.join(OUTPUT_DIR, `${styleKey}.jpg`);
  await downloadTo(url, outPath);
  log.done(`Saved ${path.relative(process.cwd(), outPath)}`);
  return outPath;
}

// ── Main ──
async function main() {
  log.title("Pawtré Studio · Sample Generator");

  if (!FAL_KEY) {
    log.fail("FAL_API_KEY is not set. See instructions at top of this file.");
    process.exit(1);
  }

  const refPath = findReference();
  if (!refPath) {
    log.fail("No reference photo found. Drop one of these into the project:");
    REFERENCE_CANDIDATES.forEach(c => log.info(c));
    process.exit(1);
  }
  log.info(`Reference: ${path.relative(process.cwd(), refPath)}`);

  ensureDir(OUTPUT_DIR);

  const argStyle = process.argv.find(a => STYLES[a]);
  const targets = argStyle ? [argStyle] : Object.keys(STYLES);

  const imageDataUrl = toDataUrl(refPath);

  log.info(`Model:      ${FAL_MODEL}`);
  log.info(`Aspect:     3:4 portrait`);
  log.info(`Steps:      30`);
  log.info(`Styles:     ${targets.join(", ")}`);

  const results = [];
  for (const styleKey of targets) {
    try {
      const out = await generateOne(styleKey, imageDataUrl);
      results.push({ style: styleKey, status: "ok", path: out });
    } catch (err) {
      log.fail(`${styleKey}: ${err.message}`);
      results.push({ style: styleKey, status: "failed", error: err.message });
    }
  }

  log.title("Summary");
  results.forEach(r => {
    if (r.status === "ok") log.done(`${r.style} → ${path.relative(process.cwd(), r.path)}`);
    else                   log.fail(`${r.style} → ${r.error}`);
  });

  const ok = results.filter(r => r.status === "ok").length;
  console.log(`\nDone. ${ok}/${results.length} samples generated.`);
  if (ok > 0) {
    console.log(`\nNext: open samples.html in a browser to preview the gallery.\n`);
  }
}

main().catch(err => {
  log.fail(`Fatal: ${err.message}`);
  process.exit(1);
});
