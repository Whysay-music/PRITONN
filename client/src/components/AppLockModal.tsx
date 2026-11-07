import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Delete, ShieldCheck, KeyRound } from 'lucide-react';

interface AppLockModalProps {
  isLocked: boolean;
  savedPin: string | null;
  onUnlock: () => void;
  onSetNewPin?: (newPin: string) => void;
  isSettingPin?: boolean;
  onCloseSetup?: () => void;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({
  isLocked,
  savedPin,
  onUnlock,
  onSetNewPin,
  isSettingPin = false,
  onCloseSetup,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [confirmPinMode, setConfirmPinMode] = useState(false);
  const [tempPin, setTempPin] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setEnteredPin('');
    setErrorShake(false);
    setConfirmPinMode(false);
    setTempPin('');
    setHint(null);
  }, [isLocked, isSettingPin]);

  if (!isLocked && !isSettingPin) return null;

  const handleDigit = (digit: string) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);

    if (nextPin.length === 4) {
      if (isSettingPin) {
        if (!confirmPinMode) {
          setTempPin(nextPin);
          setEnteredPin('');
          setConfirmPinMode(true);
          setHint('Повторите 4-значный код-пароль');
        } else {
          if (nextPin === tempPin) {
            onSetNewPin?.(nextPin);
            onCloseSetup?.();
          } else {
            setErrorShake(true);
            setHint('Коды не совпадают! Попробуйте снова');
            setTimeout(() => {
              setErrorShake(false);
              setEnteredPin('');
              setConfirmPinMode(false);
              setTempPin('');
            }, 800);
          }
        }
      } else {
        // Unlock verification
        if (nextPin === savedPin) {
          onUnlock();
        } else {
          setErrorShake(true);
          setHint('Неверный код-пароль');
          setTimeout(() => {
            setErrorShake(false);
            setEnteredPin('');
          }, 600);
        }
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0e1621]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none text-white animate-fade-in">
      <div className={`flex flex-col items-center max-w-xs w-full transition-transform ${errorShake ? 'animate-bounce text-rose-400' : ''}`}>
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-full bg-blue-500/20 text-[#3390ec] flex items-center justify-center mb-4 shadow-lg border border-blue-500/30">
          {isSettingPin ? <KeyRound size={32} /> : <Lock size={32} />}
        </div>

        <h2 className="text-xl font-bold mb-1 tracking-tight text-center">
          {isSettingPin
            ? confirmPinMode
              ? 'Подтверждение PIN-кода'
              : 'Установите PIN-код'
            : 'PRITONN заблокирован'}
        </h2>
        <p className="text-xs text-[#7f91a4] mb-6 text-center">
          {hint || (isSettingPin ? 'Введите 4 цифры для защиты переписки' : 'Введите код-пароль для входа')}
        </p>

        {/* 4 PIN Dots */}
        <div className="flex items-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                enteredPin.length > i
                  ? 'bg-[#3390ec] border-[#3390ec] scale-110 shadow-md shadow-blue-500/40'
                  : 'border-[#7f91a4]/40 bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* 3x4 Number Keypad */}
        <div className="grid grid-cols-3 gap-3 w-64 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-[#17212b] hover:bg-[#242f3d] active:scale-90 transition text-2xl font-semibold flex items-center justify-center border border-white/5 cursor-pointer shadow-sm"
            >
              {digit}
            </button>
          ))}
          <div className="h-16 flex items-center justify-center">
            {isSettingPin && onCloseSetup && (
              <button
                type="button"
                onClick={onCloseSetup}
                className="text-xs text-[#7f91a4] hover:text-white transition"
              >
                Отмена
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-[#17212b] hover:bg-[#242f3d] active:scale-90 transition text-2xl font-semibold flex items-center justify-center border border-white/5 cursor-pointer shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-[#17212b]/60 hover:bg-[#242f3d] active:scale-90 transition flex items-center justify-center text-[#7f91a4] hover:text-white border border-white/5 cursor-pointer"
          >
            <Delete size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
