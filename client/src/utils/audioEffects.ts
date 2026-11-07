// Web Audio API Real-Time Voice Changer Engine for PRITONN
export type VoiceEffectType = 'normal' | 'robot' | 'chipmunk' | 'deep' | 'echo' | 'radio';

export interface VoiceEffectInfo {
  id: VoiceEffectType;
  name: string;
  icon: string;
  description: string;
}

export const AVAILABLE_VOICE_EFFECTS: VoiceEffectInfo[] = [
  { id: 'normal', name: 'Обычный', icon: '🎙️', description: 'Естественный голос без обработки' },
  { id: 'robot', name: 'Робот', icon: '🤖', description: 'Металлический кибер-голос' },
  { id: 'chipmunk', name: 'Бурундук', icon: '🐿️', description: 'Высокий мультяшный голос (+6 полутонов)' },
  { id: 'deep', name: 'Глубокий бас', icon: '👹', description: 'Низкий тёмный голос (-5 полутонов)' },
  { id: 'echo', name: 'Космос / Эхо', icon: '🌌', description: 'Пространственное затухающее эхо' },
  { id: 'radio', name: 'Рация', icon: '📻', description: 'Эффект полицейской рации с перегрузом' },
];

/**
 * Real-time dual-grain Hann-windowed pitch shifter running 100% on the native Web Audio thread.
 * Shifts voice pitch by `semitones` without changing speaking speed or causing clicks.
 */
function createPitchShifter(
  ctx: AudioContext,
  input: AudioNode,
  output: AudioNode,
  semitones: number
): () => void {
  const ratio = Math.pow(2, semitones / 12);
  const grainDuration = 0.080; // 80ms grain
  const sampleRate = ctx.sampleRate || 48000;
  const bufferLength = Math.max(256, Math.round(grainDuration * sampleRate));

  const modBuffer1 = ctx.createBuffer(1, bufferLength, sampleRate);
  const modBuffer2 = ctx.createBuffer(1, bufferLength, sampleRate);
  const fadeBuffer1 = ctx.createBuffer(1, bufferLength, sampleRate);
  const fadeBuffer2 = ctx.createBuffer(1, bufferLength, sampleRate);

  const mod1 = modBuffer1.getChannelData(0);
  const mod2 = modBuffer2.getChannelData(0);
  const fade1 = fadeBuffer1.getChannelData(0);
  const fade2 = fadeBuffer2.getChannelData(0);

  const maxSweep = Math.abs(1 - ratio) * grainDuration;
  const halfLen = Math.floor(bufferLength / 2);

  for (let i = 0; i < bufferLength; i++) {
    const phase1 = i / bufferLength;
    const phase2 = ((i + halfLen) % bufferLength) / bufferLength;

    // If pitching up (ratio > 1), delay sweeps downward from maxSweep -> 0
    // If pitching down (ratio < 1), delay sweeps upward from 0 -> maxSweep
    mod1[i] = ratio > 1 ? (1 - phase1) * maxSweep : phase1 * maxSweep;
    mod2[i] = ratio > 1 ? (1 - phase2) * maxSweep : phase2 * maxSweep;

    // Complementary Hann windows: fade1 + fade2 === 1.0 everywhere, 0.0 at wrap boundary
    fade1[i] = 0.5 * (1 - Math.cos(2 * Math.PI * phase1));
    fade2[i] = 0.5 * (1 - Math.cos(2 * Math.PI * phase2));
  }

  const delay1 = ctx.createDelay(1.0);
  const delay2 = ctx.createDelay(1.0);
  delay1.delayTime.value = 0;
  delay2.delayTime.value = 0;

  const grainGain1 = ctx.createGain();
  const grainGain2 = ctx.createGain();
  grainGain1.gain.value = 0;
  grainGain2.gain.value = 0;

  const modSource1 = ctx.createBufferSource();
  modSource1.buffer = modBuffer1;
  modSource1.loop = true;

  const modSource2 = ctx.createBufferSource();
  modSource2.buffer = modBuffer2;
  modSource2.loop = true;

  const fadeSource1 = ctx.createBufferSource();
  fadeSource1.buffer = fadeBuffer1;
  fadeSource1.loop = true;

  const fadeSource2 = ctx.createBufferSource();
  fadeSource2.buffer = fadeBuffer2;
  fadeSource2.loop = true;

  input.connect(delay1);
  input.connect(delay2);
  delay1.connect(grainGain1);
  delay2.connect(grainGain2);
  grainGain1.connect(output);
  grainGain2.connect(output);

  modSource1.connect(delay1.delayTime);
  modSource2.connect(delay2.delayTime);
  fadeSource1.connect(grainGain1.gain);
  fadeSource2.connect(grainGain2.gain);

  const startTime = ctx.currentTime + 0.01;
  modSource1.start(startTime);
  modSource2.start(startTime);
  fadeSource1.start(startTime);
  fadeSource2.start(startTime);

  return () => {
    try { modSource1.stop(); modSource1.disconnect(); } catch {}
    try { modSource2.stop(); modSource2.disconnect(); } catch {}
    try { fadeSource1.stop(); fadeSource1.disconnect(); } catch {}
    try { fadeSource2.stop(); fadeSource2.disconnect(); } catch {}
    try { input.disconnect(delay1); input.disconnect(delay2); } catch {}
    try { delay1.disconnect(); delay2.disconnect(); } catch {}
    try { grainGain1.disconnect(); grainGain2.disconnect(); } catch {}
  };
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const nSamples = 4096;
  const buffer = new ArrayBuffer(nSamples * 4);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/**
 * Applies real-time audio effect nodes between an AudioNode source and destination
 */
export const applyVoiceEffect = (
  audioContext: AudioContext,
  sourceNode: AudioNode,
  destinationNode: AudioNode,
  effect: VoiceEffectType
): (() => void) => {
  try {
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    if (effect === 'normal') {
      sourceNode.connect(destinationNode);
      return () => {
        try { sourceNode.disconnect(destinationNode); } catch {}
      };
    }

    if (effect === 'chipmunk') {
      // Real +6.5 semitone pitch shift + bright vocal boost
      const preGain = audioContext.createGain();
      preGain.gain.value = 1.25;

      const trebleBoost = audioContext.createBiquadFilter();
      trebleBoost.type = 'highshelf';
      trebleBoost.frequency.value = 2200;
      trebleBoost.gain.value = 5;

      sourceNode.connect(preGain);
      const stopShifter = createPitchShifter(audioContext, preGain, trebleBoost, 6.5);
      trebleBoost.connect(destinationNode);

      return () => {
        stopShifter();
        try { sourceNode.disconnect(preGain); } catch {}
        try { preGain.disconnect(); } catch {}
        try { trebleBoost.disconnect(); } catch {}
      };
    }

    if (effect === 'deep') {
      // Real -5 semitone pitch shift + warm sub-bass boost
      const preGain = audioContext.createGain();
      preGain.gain.value = 1.35;

      const bassBoost = audioContext.createBiquadFilter();
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 180;
      bassBoost.gain.value = 8;

      const warmCut = audioContext.createBiquadFilter();
      warmCut.type = 'lowpass';
      warmCut.frequency.value = 3800;

      sourceNode.connect(preGain);
      const stopShifter = createPitchShifter(audioContext, preGain, bassBoost, -5);
      bassBoost.connect(warmCut);
      warmCut.connect(destinationNode);

      return () => {
        stopShifter();
        try { sourceNode.disconnect(preGain); } catch {}
        try { preGain.disconnect(); } catch {}
        try { bassBoost.disconnect(); } catch {}
        try { warmCut.disconnect(); } catch {}
      };
    }

    if (effect === 'robot') {
      // True Ring Modulation (multiplies voice by 58Hz synth carrier — zero hum when silent!)
      // + short metallic comb resonator
      const ringMod = audioContext.createGain();
      ringMod.gain.value = 0; // Base gain MUST be 0 so carrier multiplies the signal

      const carrier = audioContext.createOscillator();
      carrier.type = 'sawtooth';
      carrier.frequency.value = 58;

      const carrierFilter = audioContext.createBiquadFilter();
      carrierFilter.type = 'lowpass';
      carrierFilter.frequency.value = 480;

      const carrierDepth = audioContext.createGain();
      carrierDepth.gain.value = 1.2;

      const combDelay = audioContext.createDelay(0.1);
      combDelay.delayTime.value = 0.014; // 14ms metallic tube resonance
      const combFeedback = audioContext.createGain();
      combFeedback.gain.value = 0.35;

      const outGain = audioContext.createGain();
      outGain.gain.value = 1.4;

      carrier.connect(carrierFilter);
      carrierFilter.connect(carrierDepth);
      carrierDepth.connect(ringMod.gain);

      sourceNode.connect(ringMod);
      ringMod.connect(outGain);

      ringMod.connect(combDelay);
      combDelay.connect(combFeedback);
      combFeedback.connect(combDelay);
      combDelay.connect(outGain);

      outGain.connect(destinationNode);
      carrier.start();

      return () => {
        try { carrier.stop(); carrier.disconnect(); } catch {}
        try { carrierFilter.disconnect(); carrierDepth.disconnect(); } catch {}
        try { sourceNode.disconnect(ringMod); ringMod.disconnect(); } catch {}
        try { combDelay.disconnect(); combFeedback.disconnect(); } catch {}
        try { outGain.disconnect(); } catch {}
      };
    }

    if (effect === 'echo') {
      // Space Echo: Dry voice + warm filtered multi-tap delay loop
      const dryGain = audioContext.createGain();
      dryGain.gain.value = 1.0;

      const delay = audioContext.createDelay(1.0);
      delay.delayTime.value = 0.28;

      const echoFilter = audioContext.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.value = 2600;

      const feedback = audioContext.createGain();
      feedback.gain.value = 0.46;

      const wetGain = audioContext.createGain();
      wetGain.gain.value = 0.65;

      sourceNode.connect(dryGain);
      dryGain.connect(destinationNode);

      sourceNode.connect(delay);
      delay.connect(echoFilter);
      echoFilter.connect(feedback);
      feedback.connect(delay);
      echoFilter.connect(wetGain);
      wetGain.connect(destinationNode);

      return () => {
        try { sourceNode.disconnect(dryGain); sourceNode.disconnect(delay); } catch {}
        try { dryGain.disconnect(); delay.disconnect(); echoFilter.disconnect(); } catch {}
        try { feedback.disconnect(); wetGain.disconnect(); } catch {}
      };
    }

    if (effect === 'radio') {
      // Walkie-Talkie: Narrow bandpass + soft overdrive crunch
      const lowCut = audioContext.createBiquadFilter();
      lowCut.type = 'highpass';
      lowCut.frequency.value = 520;

      const highCut = audioContext.createBiquadFilter();
      highCut.type = 'lowpass';
      highCut.frequency.value = 2500;

      const shaper = audioContext.createWaveShaper();
      shaper.curve = makeDistortionCurve(35);
      shaper.oversample = '2x';

      const outGain = audioContext.createGain();
      outGain.gain.value = 0.9;

      sourceNode.connect(lowCut);
      lowCut.connect(highCut);
      highCut.connect(shaper);
      shaper.connect(outGain);
      outGain.connect(destinationNode);

      return () => {
        try { sourceNode.disconnect(lowCut); } catch {}
        try { lowCut.disconnect(); highCut.disconnect(); shaper.disconnect(); outGain.disconnect(); } catch {}
      };
    }
  } catch (err) {
    console.error('Error applying voice effect:', err);
    try { sourceNode.connect(destinationNode); } catch {}
  }

  return () => {
    try { sourceNode.disconnect(destinationNode); } catch {}
  };
};
