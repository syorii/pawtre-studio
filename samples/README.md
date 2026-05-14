# Pawtré Studio — Sample Portraits

This folder holds the **canonical sample portrait** for each of the five signature styles. They are displayed on:

- The homepage style cards (`index.html`)
- The hero portrait stack (`index.html`)
- The full samples gallery (`samples.html`)

## Expected files

```
samples/renaissance.jpg
samples/oil.jpg
samples/modern.jpg
samples/watercolour.jpg
samples/cosmic.jpg
```

## Generating / regenerating

See [`scripts/README.md`](../scripts/README.md). The short version:

```bash
# 1. Drop a reference pet photo
#    scripts/reference-pet.jpg

# 2. Set your fal.ai key
export FAL_API_KEY="..."

# 3. Generate all five
node scripts/generate-samples.js
```

If any file is missing, the site falls back to gradient placeholders — no broken images.
