# Pawtré Studio — Scripts

## `generate-samples.js`

Produces a consistent set of five sample portraits — one per style — that the customer-facing site uses as the gallery and as the homepage style-card thumbnails.

The script re-uses the **exact same prompts, seeds, model and aspect ratio** as the production generator at [`netlify/functions/generate-portrait.js`](../netlify/functions/generate-portrait.js). What customers see on the site is what they receive on print.

### One-time setup

1. Drop a clear, well-lit reference pet photo here:

   ```
   scripts/reference-pet.jpg
   ```

   (`.jpeg`, `.png`, `.webp` also accepted.)

   Best results:
   - Single pet, no other animals or people in frame
   - Pet facing the camera or at a slight three-quarter angle
   - Eyes clearly visible and in focus
   - Even, natural lighting
   - At least 1024 × 1024 pixels

2. Set your fal.ai API key in the current shell:

   **PowerShell**
   ```powershell
   $env:FAL_API_KEY = "your-fal-key-here"
   ```

   **bash / zsh**
   ```bash
   export FAL_API_KEY="your-fal-key-here"
   ```

### Running it

From the project root:

```bash
# Generate all five styles
node scripts/generate-samples.js

# Re-generate just one style
node scripts/generate-samples.js renaissance
node scripts/generate-samples.js cosmic
```

Output is written to:

```
samples/renaissance.jpg
samples/oil.jpg
samples/modern.jpg
samples/watercolour.jpg
samples/cosmic.jpg
```

The homepage style cards and `samples.html` will pick these up automatically. If a sample file is missing, the gradient placeholder shows instead — no broken images.

### How consistency works

- **Locked seeds per style** — every run of `renaissance` uses seed `1492`, so the same reference photo always produces the same artwork.
- **Locked composition prompt** — every style enforces head-and-shoulders bust, three-quarter angle, eyes in upper third, identical framing.
- **Flux Pro Kontext** — the fal.ai model is specifically designed to preserve subject identity across heavy stylisation, so the pet remains recognisable in all five styles.

### Cost

At time of writing, Flux Pro Kontext bills roughly **US $0.04 per generated image** on fal.ai. A full sample sweep of 5 styles is ~$0.20.
