const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOGETHER_API_KEY = 'tgp_v1_dOfKZaITI3gdD5m06Llk8ASPzUWhEyd2TG0J_uYXw2k';
const VIDEOS_DIR = path.join(__dirname, '..', 'source-materials', 'videos');
const AUDIO_DIR = path.join(__dirname, '..', 'source-materials', 'audio-tmp');
const OUTPUT_PATH = path.join(__dirname, 'src', '_data', 'videoTranscripts.json');

if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

let transcripts = {};
if (fs.existsSync(OUTPUT_PATH)) {
  transcripts = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
}

function transcribe(audioPath) {
  const result = execSync(`curl -s -X POST "https://api.together.xyz/v1/audio/transcriptions" \
    -H "Authorization: Bearer ${TOGETHER_API_KEY}" \
    -F "file=@${audioPath}" \
    -F "model=openai/whisper-large-v3" \
    -F "response_format=verbose_json"`, { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(result.toString());
}

const videos = fs.readdirSync(VIDEOS_DIR).filter(f => /\.(mp4|mov|avi|mkv|webm)$/i.test(f));
console.log(`Found ${videos.length} videos, ${Object.keys(transcripts).length} already done`);

let done = 0;
for (const video of videos) {
  if (transcripts[video]) { done++; continue; }

  const videoPath = path.join(VIDEOS_DIR, video);
  const audioPath = path.join(AUDIO_DIR, video.replace(/\.[^.]+$/, '.mp3'));

  // Extract audio
  if (!fs.existsSync(audioPath)) {
    try {
      execSync(`ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -q:a 4 "${audioPath}" 2>/dev/null`);
    } catch (e) {
      console.log(`  SKIP (no audio): ${video}`);
      transcripts[video] = { text: '', error: 'no audio' };
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(transcripts, null, 2));
      continue;
    }
  }

  try {
    console.log(`  Transcribing: ${video}...`);
    const result = transcribe(audioPath);
    transcripts[video] = { text: result.text || '', segments: result.segments || [], language: result.language || '' };
    done++;
    console.log(`  [${done}/${videos.length}] ${(result.text || '').slice(0, 80)}`);
  } catch (e) {
    console.log(`  ERROR: ${video} - ${e.message}`);
    transcripts[video] = { text: '', error: e.message };
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(transcripts, null, 2));
}

console.log(`\nDone! ${Object.keys(transcripts).length} videos transcribed.`);
