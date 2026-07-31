/**
 * Generate lightweight WebP thumbs for gallery grid.
 * Usage: node scripts/gen-thumbs.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "images");
const THUMB_DIR = path.join(ROOT, "images", "thumbs");
const JSON_PATH = path.join(ROOT, "images.json");

const MAX_W = 360;
const QUALITY = 62;

async function main() {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /^img_\d+\.webp$/i.test(f))
    .sort();

  let old = [];
  try {
    old = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  } catch (_) {}
  const bySrc = Object.fromEntries(old.map((o) => [o.src, o]));

  let totalSrc = 0;
  let totalThumb = 0;
  const out = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const srcPath = path.join(SRC_DIR, f);
    const thumbName = f;
    const thumbPath = path.join(THUMB_DIR, thumbName);
    const srcRel = `images/${f}`;
    const thumbRel = `images/thumbs/${thumbName}`;

    const srcStat = fs.statSync(srcPath);
    totalSrc += srcStat.size;

    // skip regenerate if thumb exists and is newer
    const need =
      !fs.existsSync(thumbPath) ||
      fs.statSync(thumbPath).mtimeMs < srcStat.mtimeMs;

    if (need) {
      await sharp(srcPath)
        .rotate()
        .resize({
          width: MAX_W,
          height: MAX_W * 2,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: QUALITY, effort: 4 })
        .toFile(thumbPath);
    }

    const tStat = fs.statSync(thumbPath);
    totalThumb += tStat.size;

    const prev = bySrc[srcRel] || {};
    out.push({
      src: srcRel,
      thumb: thumbRel,
      name: prev.name || f,
      date: prev.date || null,
      caption: prev.caption || null,
      size: srcStat.size,
      thumbSize: tStat.size,
    });

    if ((i + 1) % 30 === 0 || i === files.length - 1) {
      process.stdout.write(`\r  thumbs ${i + 1}/${files.length}`);
    }
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log("\nDone.");
  console.log(
    `  originals: ${(totalSrc / 1e6).toFixed(1)} MB → thumbs: ${(totalThumb / 1e6).toFixed(1)} MB (${(
      (totalThumb / totalSrc) *
      100
    ).toFixed(1)}%)`
  );
  console.log(`  entries: ${out.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
