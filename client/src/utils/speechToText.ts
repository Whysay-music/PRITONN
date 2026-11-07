// Real Offline/Universal Speech-to-Text Engine for Voice & Audio Messages
// Uses HuggingFace Transformers.js (Whisper-tiny q8 WASM) loaded dynamically on demand:
// - Works identically in Electron Desktop, Android Capacitor WebView, and Web Browsers
// - Requires 0 API keys, adds 0 KB to initial bundle, never steals microphone during recording

let asrPipelinePromise: Promise<any> | null = null;

const loadWhisperPipeline = async (onStatus?: (status: string) => void): Promise<any> => {
  if (!asrPipelinePromise) {
    asrPipelinePromise = (async () => {
      onStatus?.('Загрузка языковой модели...');
      const transformersUrl =
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0/dist/transformers.min.js';
      const mod: any = await import(/* @vite-ignore */ transformersUrl);
      if (mod.env) {
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = true;
      }
      const transcriber = await mod.pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          dtype: 'q8',
          progress_callback: (prog: any) => {
            if (prog && prog.status === 'progress' && typeof prog.progress === 'number') {
              onStatus?.(`Загрузка модели речи (${Math.round(prog.progress)}%)...`);
            }
          },
        }
      );
      return transcriber;
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

  // Fallback linear resampling if OfflineAudioContext is unavailable
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
  onStatus?: (status: string) => void
): Promise<string> => {
  if (!audioUrl || !audioUrl.trim()) {
    return 'Нет аудиозаписи для распознавания.';
  }

  onStatus?.('Обработка звука...');
  const pcm16k = await decodeAudioTo16kHzMono(audioUrl);

  // Check RMS energy so completely silent recordings report clearly instead of hallucinating
  let sumSq = 0;
  for (let i = 0; i < pcm16k.length; i++) {
    sumSq += pcm16k[i] * pcm16k[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, pcm16k.length));
  if (rms < 0.0008) {
    return '[Тишина — речь на записи не обнаружена]';
  }

  const transcriber = await loadWhisperPipeline(onStatus);
  onStatus?.('Распознавание речи...');

  const output = await transcriber(pcm16k, {
    language: 'russian',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const rawText = (typeof output === 'string' ? output : output?.text || '').trim();

  // Filter out common Whisper silence artifacts like "(субтитры)" or "[музыка]" if empty speech
  const cleaned = rawText
    .replace(/^\s*\[.*?\]\s*$/g, '')
    .replace(/Редактор субтитров.*$/i, '')
    .replace(/Субтитры сделал.*$/i, '')
    .trim();

  if (!cleaned) {
    return '[Речь не распознана]';
  }

  return cleaned;
};
