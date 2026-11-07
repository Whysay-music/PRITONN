import React, { useEffect, useState } from 'react';

interface FullscreenEmojiEffectProps {
  emoji: string;
  onComplete: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
}

export const FullscreenEmojiEffect: React.FC<FullscreenEmojiEffectProps> = ({
  emoji,
  onComplete,
}) => {
  const [particles] = useState<Particle[]>(() => {
    return Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: Math.random() * 80 + 10, // 10% to 90%
      y: Math.random() * 50 + 50, // start near bottom
      size: Math.random() * 24 + 20, // 20px to 44px
      delay: Math.random() * 0.4,
      duration: Math.random() * 1.5 + 1.2,
      rotation: Math.random() * 60 - 30,
    }));
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute transition-transform will-change-transform"
          style={{
            left: `${p.x}vw`,
            bottom: `${p.y}vh`,
            fontSize: `${p.size}px`,
            animation: `flyUpEffect ${p.duration}s cubic-bezier(0.2, 0.8, 0.2, 1) ${p.delay}s forwards`,
          }}
        >
          {emoji}
        </div>
      ))}
      <style>{`
        @keyframes flyUpEffect {
          0% {
            transform: translateY(0) scale(0.6) rotate(0deg);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translateY(-80px) scale(1.2) rotate(15deg);
          }
          80% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(-450px) scale(1.4) rotate(45deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
