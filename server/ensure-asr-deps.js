// Ensures native postinstall binaries for ffmpeg-static and onnxruntime-node are present
// across both npm v10 (auto-postinstall) and npm v11+ (allowScripts)
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runScriptSafe(relPath, label) {
  const fullPath = path.join(__dirname, relPath);
  if (!fs.existsSync(fullPath)) return;
  console.log(`[ASR Setup] Checking ${label}...`);
  const res = spawnSync(process.execPath, [fullPath], {
    cwd: path.dirname(fullPath),
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    console.warn(`[ASR Setup] Warning: ${label} exited with code ${res.status}`);
  }
}

runScriptSafe('node_modules/ffmpeg-static/install.js', 'ffmpeg-static');
runScriptSafe('node_modules/onnxruntime-node/script/install.js', 'onnxruntime-node');
