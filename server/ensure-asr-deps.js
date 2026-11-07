// Ensures native postinstall binary for ffmpeg-static is present across npm v10 and npm v11+
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fullPath = path.join(__dirname, 'node_modules/ffmpeg-static/install.js');
if (fs.existsSync(fullPath)) {
  console.log('[ASR Setup] Checking ffmpeg-static...');
  spawnSync(process.execPath, [fullPath], {
    cwd: path.dirname(fullPath),
    stdio: 'inherit',
  });
}
