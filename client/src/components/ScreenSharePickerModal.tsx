import React, { useState } from 'react';
import { Monitor, AppWindow, X, Check } from 'lucide-react';

export interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string | null;
  display_id?: string;
}

interface ScreenSharePickerModalProps {
  isOpen: boolean;
  sources: DesktopSource[];
  onSelectSource: (source: DesktopSource) => void;
  onClose: () => void;
}

export const ScreenSharePickerModal: React.FC<ScreenSharePickerModalProps> = ({
  isOpen,
  sources,
  onSelectSource,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'screen' | 'window'>('screen');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    sources[0]?.id || null
  );

  if (!isOpen) return null;

  const screens = sources.filter(
    (s) => s.id.startsWith('screen:') || s.name.toLowerCase().includes('screen') || s.name.toLowerCase().includes('экран')
  );
  const windows = sources.filter(
    (s) => !screens.some((sc) => sc.id === s.id)
  );

  const displayList = activeTab === 'screen' ? (screens.length > 0 ? screens : sources) : windows;

  const currentSelected =
    sources.find((s) => s.id === selectedSourceId) || displayList[0] || null;

  return (
    <div
      style={{ zIndex: 10000 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none"
    >
      <div className="bg-[#17212b] border border-[#242f3d] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242f3d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#2481cc]/20 flex items-center justify-center text-[#5288c1]">
              <Monitor size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Выбор экрана или окна</h3>
              <p className="text-xs text-[#7f91a4]">Выберите, чем вы хотите поделиться в звонке</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7f91a4] hover:text-white hover:bg-[#202b36] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs: Screens vs Windows */}
        <div className="flex items-center px-5 pt-3 gap-2 border-b border-[#242f3d]/60 bg-[#0e1621]/40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('screen');
              if (screens.length > 0) setSelectedSourceId(screens[0].id);
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'screen'
                ? 'border-[#5288c1] text-[#5288c1]'
                : 'border-transparent text-[#7f91a4] hover:text-white'
            }`}
          >
            <Monitor size={15} />
            <span>Весь экран ({screens.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('window');
              if (windows.length > 0) setSelectedSourceId(windows[0].id);
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'window'
                ? 'border-[#5288c1] text-[#5288c1]'
                : 'border-transparent text-[#7f91a4] hover:text-white'
            }`}
          >
            <AppWindow size={15} />
            <span>Окна программ ({windows.length})</span>
          </button>
        </div>

        {/* Source Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 sm:grid-cols-3 gap-3.5 no-scrollbar min-h-[260px]">
          {displayList.map((source) => {
            const isSelected = selectedSourceId === source.id;
            return (
              <div
                key={source.id}
                onClick={() => setSelectedSourceId(source.id)}
                className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all flex flex-col bg-[#0e1621] ${
                  isSelected
                    ? 'border-[#5288c1] shadow-lg shadow-[#5288c1]/20 scale-[1.02]'
                    : 'border-[#242f3d] hover:border-[#5288c1]/50'
                }`}
              >
                {/* Thumbnail Preview */}
                <div className="aspect-video w-full bg-black/60 flex items-center justify-center overflow-hidden relative">
                  {source.thumbnail ? (
                    <img
                      src={source.thumbnail}
                      alt={source.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                  ) : (
                    <Monitor size={32} className="text-[#7f91a4]" />
                  )}

                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#5288c1] text-white flex items-center justify-center shadow">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Title & Icon */}
                <div className="p-2.5 flex items-center gap-2 min-w-0 bg-[#17212b]">
                  {source.appIcon && (
                    <img src={source.appIcon} alt="" className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-white truncate flex-1 leading-snug">
                    {source.name}
                  </span>
                </div>
              </div>
            );
          })}

          {displayList.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-[#7f91a4]">
              <AppWindow size={36} className="mb-2 opacity-50" />
              <p className="text-xs">Нет доступных окон для захвата</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#242f3d] flex items-center justify-end gap-2.5 bg-[#0e1621]/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#242f3d] hover:bg-[#202b36] text-sm text-[#7f91a4] hover:text-white font-medium transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!currentSelected}
            onClick={() => {
              if (currentSelected) {
                onSelectSource(currentSelected);
              }
            }}
            className="px-5 py-2 rounded-xl bg-[#2481cc] hover:bg-[#1e70b3] disabled:opacity-50 text-sm text-white font-semibold shadow-md transition cursor-pointer active:scale-95"
          >
            Начать трансляцию
          </button>
        </div>
      </div>
    </div>
  );
};
