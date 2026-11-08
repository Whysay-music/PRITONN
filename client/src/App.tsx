import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#94a3b8] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
      <div className="max-w-md w-full bg-[#111827] border border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-rose-500 mb-3 tracking-tight">Сервис закрыт</h1>
        <p className="text-sm leading-relaxed text-zinc-400 mb-6">
          Социальная сеть PRITONN окончательно закрыта и удалена по запросу владельца. База данных очищена, все серверные службы отключены.
        </p>
        <span className="px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold uppercase tracking-wider">
          Деактивировано навсегда (410 Gone)
        </span>
      </div>
    </div>
  );
}
