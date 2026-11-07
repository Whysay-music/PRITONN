// Universal Speech-to-Text Engine for Voice & Audio Messages
// Primary: Fast, high-accuracy Server-Side Whisper-small (Russian) via PRITONN backend + FFmpeg
//   - Works on Android APK, Windows PC, and Web without downloading WASM models or VPN
//   - Accurately recognizes Russian speech from WebM/Opus, OGG, MP4/M4A, MP3, WAV
// Fallback: Local WebAudio + Transformers.js if server ASR is unreachable

import { getApiUrl } from '../config';

let asrPipelinePromise: Promise<any> | null = null;

const loadLocalWhisperFallback = async (onStatus?: (status: string) => void): Promise<any> => {
  if (!asrPipelinePromise) {
    asrPipelinePromise = (async () => {
      onStatus?.('Загрузка резервной модели речи...');
      const transformersUrl =
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0/dist/transformers.min.js';
      const mod: any = await import(/* @vite-ignore */ transformersUrl);
      if (mod.env) {
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = true;
      }
      return await mod.pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
        dtype: 'q8',
        progress_callback: (prog: any) => {
          if (prog && prog.status === 'progress' && typeof prog.progress === 'number') {
            onStatus?.(`Загрузка модели (${Math.round(prog.progress)}%)...`);
          }
        },
      });
    })().catch((err) => {
      asrPipelinePromise = null;
      throw err;
    });
  }
  return asrPipelinePromise;
};

const decodeAudioTo16kHzMono = async (audioUrl: string): Promise<Float32Array> => {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить аудио (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength < 64) {
    throw new Error('Аудиозапись пуста');
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try {
      await audioCtx.close();
    } catch {}
  }

  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.ceil(decodedBuffer.duration * targetSampleRate));

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  if (OfflineCtx) {
    const offlineCtx = new OfflineCtx(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  }

  const srcData = decodedBuffer.getChannelData(0);
  const ratio = decodedBuffer.sampleRate / targetSampleRate;
  const out = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const idx = Math.min(srcData.length - 1, Math.floor(i * ratio));
    out[i] = srcData[idx] || 0;
  }
  return out;
};

export const transcribeAudioUrl = async (
  audioUrl: string,
  onStatus?: (status: string) => void,
  messageId?: string
): Promise<string> => {
  if (!audioUrl || !audioUrl.trim()) {
    return 'Нет аудиозаписи для распознавания.';
  }

  const apiBase = getApiUrl();

  // 1. Primary: High-accuracy server-side Russian speech recognition (Xenova/whisper-small + FFmpeg)
  try {
    onStatus?.('Распознавание речи на сервере...');
    const endpoint = messageId
      ? `${apiBase}/api/messages/${encodeURIComponent(messageId)}/transcribe`
      : `${apiBase}/api/transcribe-audio`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useServer: true,
        audioUrl,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const serverText = (data?.transcribedText || data?.text || '').trim();
      if (serverText) {
        return serverText;
      }
    }
  } catch {
    // Fall through to standalone endpoint or local fallback
  }

  // Secondary check via /api/transcribe-audio if messageId wasn't found on server yet
  if (messageId) {
    try {
      const res2 = await fetch(`${apiBase}/api/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl }),
      });
      if (res2.ok) {
        const data2 = await res2.json();
        const serverText2 = (data2?.text || '').trim();
        if (serverText2) {
          return serverText2;
        }
      }
    } catch {}
  }

  // 2. Fallback: Local browser decoding + Whisper if server is offline
  onStatus?.('Обработка звука...');
  const pcm16k = await decodeAudioTo16kHzMono(audioUrl);

  let sumSq = 0;
  for (let i = 0; i < pcm16k.length; i++) {
    sumSq += pcm16k[i] * pcm16k[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, pcm16k.length));
  if (rms < 0.0006) {
    return '[Тишина — речь на записи не обнаружена]';
  }

  const transcriber = await loadLocalWhisperFallback(onStatus);
  onStatus?.('Распознавание речи...');

  const output = await transcriber(pcm16k, {
    language: 'russian',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const rawText = (typeof output === 'string' ? output : output?.text || '').trim();
  const cleaned = rawText
    .replace(/^\s*\[.*?\]\s*$/g, '')
    .replace(/Редактор субтитров.*$/i, '')
    .replace(/Субтитры сделал.*$/i, '')
    .trim();

  return cleaned || '[Речь не распознана]';
};
