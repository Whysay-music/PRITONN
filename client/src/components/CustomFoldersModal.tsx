import React, { useState } from 'react';
import { X, FolderPlus, Trash2, Check, Folder } from 'lucide-react';
import { Chat, CustomFolder, User } from '../types';

interface CustomFoldersModalProps {
  isOpen: boolean;
  currentUser: User;
  chats: Chat[];
  onClose: () => void;
  onCreateFolder: (name: string, icon: string, chatIds: string[]) => void;
  onDeleteFolder: (folderId: string) => void;
}

const FOLDER_ICONS = ['📁', '💼', '📚', '💰', '🏠', '🎮', '⭐', '🚀', '💬', '❤️', '🔥', '🎯'];

export const CustomFoldersModal: React.FC<CustomFoldersModalProps> = ({
  isOpen,
  currentUser,
  chats,
  onClose,
  onCreateFolder,
  onDeleteFolder,
}) => {
  const [folderName, setFolderName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📁');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleToggleChat = (chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleCreate = () => {
    if (!folderName.trim()) return;
    onCreateFolder(folderName.trim(), selectedIcon, selectedChatIds);
    setFolderName('');
    setSelectedChatIds([]);
    setIsCreating(false);
  };

  const userFolders: CustomFolder[] = currentUser.customFolders || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="w-full max-w-md bg-[#17212b] rounded-3xl p-6 shadow-2xl flex flex-col border border-[#242f3d] text-[#f5f5f5] max-h-[85vh] animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#242f3d] mb-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Folder size={18} className="text-[#5288c1]" />
            <span>Папки с чатами</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-[#202b36] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing folders list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-4">
          <div className="text-xs font-semibold text-[#7f91a4] uppercase tracking-wider mb-1">
            Ваши папки
          </div>

          {userFolders.length === 0 && !isCreating && (
            <div className="text-center py-6 text-xs text-[#7f91a4]">
              У вас пока нет пользовательских папок. Создайте первую!
            </div>
          )}

          {userFolders.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#0e1621] border border-[#242f3d]"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <div className="text-sm font-semibold">{f.name}</div>
                  <div className="text-[11px] text-[#7f91a4]">
                    {f.chatIds?.length || 0} чатов
                  </div>
                </div>
              </div>
              <button
                onClick={() => onDeleteFolder(f.id)}
                className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition"
                title="Удалить папку"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {/* Create new folder card */}
          {isCreating ? (
            <div className="p-4 rounded-2xl bg-[#0e1621] border border-[#5288c1] flex flex-col gap-3 mt-2 animate-fade-in">
              <div>
                <label className="text-[11px] text-[#7f91a4] font-medium block mb-1">
                  Название папки
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Например: Работа, Учёба"
                  className="w-full bg-[#17212b] border border-[#242f3d] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#5288c1]"
                />
              </div>

              {/* Icon selector */}
              <div>
                <label className="text-[11px] text-[#7f91a4] font-medium block mb-1">
                  Иконка папки
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {FOLDER_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
                        selectedIcon === icon ? 'bg-[#5288c1] scale-110' : 'bg-[#17212b] hover:bg-[#202b36]'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat selector */}
              <div>
                <label className="text-[11px] text-[#7f91a4] font-medium block mb-1">
                  Включённые чаты
                </label>
                <div className="max-h-36 overflow-y-auto flex flex-col gap-1 border border-[#242f3d] rounded-xl p-1 bg-[#17212b]">
                  {chats.map((c) => {
                    const isSelected = selectedChatIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleChat(c.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition ${
                          isSelected ? 'bg-[#5288c1]/20 text-white' : 'hover:bg-white/5 text-[#7f91a4]'
                        }`}
                      >
                        <span className="truncate">{c.displayName || c.name}</span>
                        {isSelected && <Check size={14} className="text-[#5288c1]" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-xl text-xs hover:bg-[#202b36] text-[#7f91a4]"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!folderName.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#5288c1] hover:bg-[#4372a3] text-white disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="mt-2 p-3 rounded-2xl border border-dashed border-[#5288c1]/40 hover:border-[#5288c1] text-[#5288c1] flex items-center justify-center gap-2 text-xs font-semibold hover:bg-[#5288c1]/5 transition"
            >
              <FolderPlus size={16} />
              <span>Создать новую папку</span>
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#202b36] hover:bg-[#242f3d] text-xs font-semibold text-white transition mt-auto"
        >
          Готово
        </button>
      </div>
    </div>
  );
};
