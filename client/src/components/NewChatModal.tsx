import React, { useState, useRef } from 'react';
import { X, Radio, Users, Check, Search, UserCheck, Camera, Upload } from 'lucide-react';
import { User } from '../types';
import { API_BASE_URL } from '../config';

interface NewChatModalProps {
  isOpen: boolean;
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onCreateChat: (chatData: {
    type: 'channel' | 'group';
    name: string;
    description: string;
    username: string;
    avatar?: string;
    memberIds: string[];
  }) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=150',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=150',
];

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  currentUser,
  allUsers,
  onClose,
  onCreateChat,
}) => {
  const [type, setType] = useState<'channel' | 'group'>('group');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatar(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAvatar(data.url);
      }
    } catch (err) {
      console.error('Failed to upload custom chat photo:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Member selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchFriend, setSearchFriend] = useState('');

  if (!isOpen) return null;

  // Filter available friends to invite (exclude current user)
  const availableUsers = allUsers.filter((u) => u.id !== currentUser.id);
  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchFriend.toLowerCase()) ||
      u.username.toLowerCase().includes(searchFriend.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateChat({
      type,
      name: name.trim(),
      description: description.trim(),
      username: username ? username.replace('@', '').trim() : '',
      avatar,
      memberIds: selectedUserIds,
    });

    setName('');
    setDescription('');
    setUsername('');
    setSelectedUserIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-[var(--tg-border)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Users size={18} className="text-blue-400" />
            <span>{type === 'channel' ? 'Создать канал' : 'Создать группу'}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs: Group vs Channel */}
        <div className="flex border-b border-[var(--tg-border)] bg-[var(--tg-sidebar)]">
          <button
            type="button"
            onClick={() => setType('group')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              type === 'group'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
            }`}
          >
            <Users size={15} />
            <span>Группа (Чат сообщества)</span>
          </button>
          <button
            type="button"
            onClick={() => setType('channel')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              type === 'channel'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
            }`}
          >
            <Radio size={15} />
            <span>Канал (Вещание)</span>
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Avatar & Name */}
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCustomUpload}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500 flex-shrink-0 cursor-pointer relative group shadow-md bg-slate-800"
              title="Нажмите, чтобы загрузить фото с компьютера"
            >
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover group-hover:brightness-75 transition" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 text-white transition">
                <Camera size={20} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[var(--tg-text-muted)]">
                  Название {type === 'channel' ? 'канала' : 'группы'} *
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  <Upload size={11} />
                  <span>{isUploading ? 'Загрузка...' : 'Своё фото'}</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'channel' ? 'Например: Мой Канал' : 'Например: Чат Друзей'}
                className="w-full bg-[var(--tg-sidebar)] px-3 py-2 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1">
              Описание (необязательно)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чем этот чат..."
              className="w-full bg-[var(--tg-sidebar)] px-3 py-1.5 rounded-xl border border-[var(--tg-border)] text-xs outline-none text-[var(--tg-text)] resize-none"
            />
          </div>

          {/* Invite Friends Section */}
          <div className="bg-[var(--tg-sidebar)] p-3 rounded-xl border border-[var(--tg-border)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <UserCheck size={14} />
                <span>Пригласить пользователей в чат:</span>
              </label>
              <span className="text-[11px] text-[var(--tg-text-muted)]">
                Выбрано: {selectedUserIds.length}
              </span>
            </div>

            {/* Friend search */}
            {availableUsers.length > 4 && (
              <div className="flex items-center bg-[var(--tg-surface)] px-2.5 py-1 rounded-lg border border-[var(--tg-border)]">
                <Search size={13} className="text-[var(--tg-text-muted)] mr-1.5" />
                <input
                  type="text"
                  value={searchFriend}
                  onChange={(e) => setSearchFriend(e.target.value)}
                  placeholder="Поиск по имени или логину"
                  className="w-full bg-transparent text-xs outline-none text-[var(--tg-text)]"
                />
              </div>
            )}

            {/* Friends list */}
            {availableUsers.length === 0 ? (
              <p className="text-xs text-[var(--tg-text-muted)] text-center py-3">
                Пока нет других зарегистрированных пользователей. Вы можете создать чат сейчас и пригласить друзей позже!
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-600/20 border border-blue-500/50'
                          : 'hover:bg-[var(--tg-surface-hover)] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div className="text-xs">
                          <div className="font-semibold leading-tight">{u.name}</div>
                          <div className="text-[10px] text-[var(--tg-text-muted)]">
                            @{u.username}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-[var(--tg-border)] bg-transparent'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white text-xs font-semibold rounded-xl shadow-md transition"
            >
              Создать {type === 'channel' ? 'канал' : 'чат'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
