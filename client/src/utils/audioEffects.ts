// Web Audio API Voice Changer Effects Engine for PRITONN
export type VoiceEffectType = 'normal' | 'robot' | 'chipmunk' | 'deep' | 'echo' | 'radio';

export interface VoiceEffectInfo {
  id: VoiceEffectType;
  name: string;
  icon: string;
  description: string;
}

export const AVAILABLE_VOICE_EFFECTS: VoiceEffectInfo[] = [
  { id: 'normal', name: 'Обычный', icon: '🎙️', description: 'Естественный голос без обработки' },
  { id: 'robot', name: 'Робот', icon: '🤖', description: 'Металлический модулированный голос' },
  { id: 'chipmunk', name: 'Бурундук', icon: '🐿️', description: 'Высокий мультяшный голос' },
  { id: 'deep', name: 'Глубокий бас', icon: '📻', description: 'Низкий дикторский радио-бас' },
  { id: 'echo', name: 'Космос / Эхо', icon: '🌌', description: 'Пространственное затухающее эхо' },
  { id: 'radio', name: 'Рация', icon: '📻', description: 'Эффект рации / телефонной трубки' },
];

/**
 * Applies real-time audio effect nodes between an AudioNode source and destination
 */
export const applyVoiceEffect = (
  audioContext: AudioContext,
  sourceNode: AudioNode,
  destinationNode: AudioNode,
  effect: VoiceEffectType
): (() => void) => {
  // Cleanup callbacks
  const cleanupFns: (() => void)[] = [];

  try {
    if (effect === 'normal') {
      sourceNode.connect(destinationNode);
      return () => {
        try { sourceNode.disconnect(destinationNode); } catch {}
      };
    }

    if (effect === 'deep') {
      // Deep Bass: Low-shelf boost + gentle high cut
      const bassBoost = audioContext.createBiquadFilter();
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 160;
      bassBoost.gain.value = 14; // +14dB bass

      const highCut = audioContext.createBiquadFilter();
      highCut.type = 'lowpass';
      highCut.frequency.value = 2800; // roll off highs for warm deep feel

      sourceNode.connect(bassBoost);
      bassBoost.connect(highCut);
      highCut.connect(destinationNode);

      return () => {
        try {
          sourceNode.disconnect(bassBoost);
          bassBoost.disconnect(highCut);
          highCut.disconnect(destinationNode);
        } catch {}
      };
    }

    if (effect === 'chipmunk') {
      // Chipmunk: High-pass + high-shelf boost
      const highPass = audioContext.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 500;

      const trebleBoost = audioContext.createBiquadFilter();
      trebleBoost.type = 'highshelf';
      trebleBoost.frequency.value = 2000;
      trebleBoost.gain.value = 12;

      sourceNode.connect(highPass);
      highPass.connect(trebleBoost);
      trebleBoost.connect(destinationNode);

      return () => {
        try {
          sourceNode.disconnect(highPass);
          highPass.disconnect(trebleBoost);
          trebleBoost.disconnect(destinationNode);
        } catch {}
      };
    }

    if (effect === 'robot') {
      // Robot: Ring modulation with oscillator carrier
      const carrier = audioContext.createOscillator();
      carrier.type = 'sawtooth';
      carrier.frequency.value = 65; // 65 Hz robotic buzz

      const carrierGain = audioContext.createGain();
      carrierGain.gain.value = 0.5;

      const modulatorGain = audioContext.createGain();
      modulatorGain.gain.value = 0.5;

      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1000;
      bandpass.Q.value = 2;

      carrier.connect(carrierGain);
      sourceNode.connect(modulatorGain);

      // Mix through bandpass
      carrierGain.connect(bandpass);
      modulatorGain.connect(bandpass);
      bandpass.connect(destinationNode);

      carrier.start();

      return () => {
        try {
          carrier.stop();
          carrier.disconnect();
          carrierGain.disconnect();
          sourceNode.disconnect(modulatorGain);
          modulatorGain.disconnect();
          bandpass.disconnect();
        } catch {}
      };
    }

    if (effect === 'echo') {
      // Space Echo: Delay node + Feedback gain loop
      const delay = audioContext.createDelay();
      delay.delayTime.value = 0.32; // 320ms echo

      const feedback = audioContext.createGain();
      feedback.gain.value = 0.42; // decaying repeats

      const wetGain = audioContext.createGain();
      wetGain.gain.value = 0.6;

      // Dry path (direct voice)
      sourceNode.connect(destinationNode);

      // Wet path (echo repeats)
      sourceNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(destinationNode);

      return () => {
        try {
          sourceNode.disconnect(destinationNode);
          sourceNode.disconnect(delay);
          delay.disconnect(feedback);
          feedback.disconnect(delay);
          delay.disconnect(wetGain);
          wetGain.disconnect(destinationNode);
        } catch {}
      };
    }

    if (effect === 'radio') {
      // Walkie-talkie / Phone: Bandpass filter (300Hz - 3400Hz) + distortion wave shaper
      const lowCut = audioContext.createBiquadFilter();
      lowCut.type = 'highpass';
      lowCut.frequency.value = 450;

      const highCut = audioContext.createBiquadFilter();
      highCut.type = 'lowpass';
      highCut.frequency.value = 2800;

      const midPeak = audioContext.createBiquadFilter();
      midPeak.type = 'peaking';
      midPeak.frequency.value = 1200;
      midPeak.gain.value = 6;

      sourceNode.connect(lowCut);
      lowCut.connect(highCut);
      highCut.connect(midPeak);
      midPeak.connect(destinationNode);

      return () => {
        try {
          sourceNode.disconnect(lowCut);
          lowCut.disconnect(highCut);
          highCut.disconnect(midPeak);
          midPeak.disconnect(destinationNode);
        } catch {}
      };
    }
  } catch (err) {
    console.error('Error applying voice effect:', err);
    // Fallback direct connection
    try { sourceNode.connect(destinationNode); } catch {}
  }

  return () => {
    try { sourceNode.disconnect(destinationNode); } catch {}
  };
};
