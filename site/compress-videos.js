const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = path.join(__dirname, '..', 'source-materials', 'videos');
const OUT_DIR = path.join(__dirname, 'src', 'assets', 'videos');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const videos = fs.readdirSync(SOURCE_DIR).filter(f => /\.(mp4|mov|avi|mkv|webm)$/i.test(f));
console.log(`Compressing ${videos.length} videos to 720p...`);

let done = 0;
for (const video of videos) {
  const src = path.join(SOURCE_DIR, video);
  const out = path.join(OUT_DIR, video.replace(/\.[^.]+$/, '.mp4'));

  if (fs.existsSync(out)) { done++; continue; }

  try {
    execSync(`ffmpeg -y -i "${src}" -vf "scale=-2:720" -c:v libx264 -preset medium -crf 28 -c:a aac -b:a 96k "${out}" 2>/dev/null`);
    const size = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
    done++;
    console.log(`  [${done}/${videos.length}] ${video} → ${size}MB`);
  } catch (e) {
    console.log(`  ERROR: ${video} - ${e.message}`);
  }
}

console.log(`\nDone! ${done} videos compressed to ${OUT_DIR}`);
const totalMB = fs.readdirSync(OUT_DIR).reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0) / 1024 / 1024;
console.log(`Total size: ${totalMB.toFixed(0)}MB`);
