import React, { useState, useRef } from 'react';
import { Send, UserPlus, LogIn, Camera, Eye, EyeOff, Upload, Check, Globe } from 'lucide-react';
import { User } from '../types';
import { getApiUrl, setCustomServerUrl, DEFAULT_ONLINE_SERVER } from '../config';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');

  // Registration state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [currentServerInput, setCurrentServerInput] = useState(getApiUrl());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle local avatar file selection & upload
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file to server
    setIsUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const targetUrl = getApiUrl();
      const res = await fetch(`${targetUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Не удалось загрузить изображение');
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Not JSON
      }
      if (data?.url) {
        setAvatarUrl(data.url);
      }
    } catch {
      // Fallback: use data URI preview directly so avatar is never lost
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Пожалуйста, введите ваше имя');
      return;
    }
    if (!username.trim()) {
      setError('Пожалуйста, укажите логин');
      return;
    }
    if (!password || password.length < 4) {
      setError('Пароль должен быть не менее 4 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const targetUrl = getApiUrl();
      const finalAvatar = avatarUrl || avatarPreview || undefined;
      const res = await fetch(`${targetUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          password: password.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          avatar: finalAvatar,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Not JSON response
      }

      if (!res.ok) {
        throw new Error(data?.error || `Сервер недоступен (${res.status}). Проверьте адрес подключения`);
      }
      if (!data) {
        throw new Error('Сервер вернул некорректный ответ. Проверьте адрес сервера');
      }

      onLoginSuccess(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Неизвестная ошибка подключения к серверу');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim()) {
      setError('Введите логин');
      return;
    }
    if (!loginPassword.trim()) {
      setError('Введите пароль');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const targetUrl = getApiUrl();
      const res = await fetch(`${targetUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Not JSON
      }

      if (!res.ok) {
        throw new Error(data?.error || `Ошибка авторизации (${res.status}). Неверный логин или пароль`);
      }
      if (!data) {
        throw new Error('Сервер вернул некорректный ответ. Проверьте адрес сервера');
      }

      onLoginSuccess(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Неизвестная ошибка подключения к серверу');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-[#0e1621] text-[#f5f5f5] p-4 select-none relative overflow-y-auto">
      {/* Background radial glow */}
      <div className="fixed w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#17212b] border border-[#242f3d] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 animate-pop-in my-auto">
        {/* Top App Logo */}
        <div className="pt-7 pb-3 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full overflow-hidden shadow-xl shadow-purple-500/20 border-2 border-purple-500/40 mb-2.5 flex items-center justify-center bg-[#101921]">
            <img src="/logo.jpg" alt="PRITONN" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">PRITONN</h1>
          <p className="text-xs text-[#7f91a4] mt-1 text-center px-4">
            {mode === 'register'
              ? 'Создайте свой аккаунт с логином, паролем и аватаркой'
              : 'Вход в аккаунт по логину и паролю'}
          </p>
        </div>

        {/* Switcher tabs */}
        <div className="flex border-b border-[#242f3d] mx-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              mode === 'login'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#7f91a4] hover:text-white'
            }`}
          >
            <LogIn size={15} />
            <span>Вход</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              mode === 'register'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#7f91a4] hover:text-white'
            }`}
          >
            <UserPlus size={15} />
            <span>Регистрация</span>
          </button>
        </div>

        {/* Error message banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs animate-pop-in text-center font-medium">
            {error}
          </div>
        )}

        {/* Form content */}
        <div className="p-6">
          {mode === 'register' ? (
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              {/* Custom Avatar Upload */}
              <div className="flex flex-col items-center mb-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-full cursor-pointer group transition hover:scale-105 border-2 border-dashed border-blue-500/50 hover:border-blue-500 overflow-hidden bg-[#242f3d] flex items-center justify-center shadow-inner"
                  title="Нажмите, чтобы загрузить фото с компьютера"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#7f91a4] group-hover:text-blue-400">
                      <Camera size={26} />
                    </div>
                  )}

                  {/* Overlay button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                    <Upload size={18} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium mt-2 flex items-center gap-1"
                >
                  <Upload size={13} />
                  <span>
                    {avatarPreview
                      ? isUploadingAvatar
                        ? 'Загрузка...'
                        : 'Сменить аватарку'
                      : 'Загрузить свою аватарку'}
                  </span>
                </button>

                {/* Avatar presets */}
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-[10px] text-[#7f91a4]">или выберите готовый аватар:</span>
                  <div className="flex items-center gap-1.5">
                    {AVATAR_PRESETS.map((p, idx) => (
                      <img
                        key={idx}
                        src={p}
                        alt="preset"
                        onClick={() => {
                          setAvatarPreview(p);
                          setAvatarUrl(p);
                        }}
                        className={`w-7 h-7 rounded-full object-cover cursor-pointer transition hover:scale-110 border-2 ${
                          avatarPreview === p ? 'border-blue-500 scale-105 shadow-md' : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-[#7f91a4] block mb-1">
                  Имя и Фамилия *
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full bg-[#242f3d] px-3.5 py-2.5 rounded-xl border border-transparent focus:border-blue-500 outline-none text-sm text-white placeholder-[#7f91a4]"
                />
              </div>

              {/* Username (Login) */}
              <div>
                <label className="text-xs font-medium text-[#7f91a4] block mb-1">
                  Логин (@username) *
                </label>
                <div className="flex items-center bg-[#242f3d] px-3.5 py-2.5 rounded-xl border border-transparent focus-within:border-blue-500">
                  <span className="text-[#7f91a4] text-sm mr-0.5">@</span>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ivan_ivanov"
                    className="w-full bg-transparent outline-none text-sm text-white placeholder-[#7f91a4]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-medium text-[#7f91a4] block mb-1">
                  Пароль *
                </label>
                <div className="flex items-center bg-[#242f3d] px-3.5 py-2.5 rounded-xl border border-transparent focus-within:border-blue-500">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 4 символа"
                    className="w-full bg-transparent outline-none text-sm text-white placeholder-[#7f91a4]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#7f91a4] hover:text-white ml-2"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs font-medium text-[#7f91a4] block mb-1">
                  Повторите пароль *
                </label>
                <div className="flex items-center bg-[#242f3d] px-3.5 py-2.5 rounded-xl border border-transparent focus-within:border-blue-500">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повтор пароля"
                    className="w-full bg-transparent outline-none text-sm text-white placeholder-[#7f91a4]"
                  />
                  {confirmPassword && confirmPassword === password && (
                    <Check size={16} className="text-emerald-400 ml-2" />
                  )}
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-2 bg-[#2481cc] hover:bg-[#1e70b3] text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </form>
          ) : (
            /* Strict Login Form: Login & Password Only */
            <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-medium text-[#7f91a4] block mb-1">
                  Логин (@username или телефон)
                </label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Ваш логин"
                  className="w-full bg-[#242f3d] px-3.5 py-2.5 rounded-xl border border-transparent focus:border-blue-500 outline-none text-sm text-white placeholder-[#7f91a4]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#7f91a4] block mb-1">
                  Пароль
                </label>
                <div className="flex items-center bg-[#242f3d] px-3.5 py-2.5 rounded-xl border border-transparent focus-within:border-blue-500">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Введите пароль"
                    className="w-full bg-transparent outline-none text-sm text-white placeholder-[#7f91a4]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#7f91a4] hover:text-white ml-2"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-1 bg-[#2481cc] hover:bg-[#1e70b3] text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isLoading ? 'Проверка...' : 'Войти'}
              </button>
            </form>
          )}

          {/* Server Connection Info & Settings */}
          <div className="mt-4 pt-3 border-t border-[#242f3d]/60 flex items-center justify-between text-xs text-[#7f91a4]">
            <div className="flex items-center gap-1.5 truncate max-w-[210px]">
              <Globe size={13} className="text-blue-400 shrink-0" />
              <span className="truncate" title={getApiUrl()}>
                {getApiUrl().replace(/^https?:\/\//, '')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCurrentServerInput(getApiUrl());
                setShowServerModal(true);
              }}
              className="text-blue-400 hover:text-blue-300 font-medium ml-2 cursor-pointer transition hover:underline"
            >
              Сменить сервер
            </button>
          </div>
        </div>
      </div>

      {/* Server Config Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17212b] border border-[#242f3d] rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <Globe size={18} className="text-blue-400" />
                Сервер PRITONN
              </div>
              <button
                onClick={() => setShowServerModal(false)}
                className="text-[#7f91a4] hover:text-white text-lg font-bold w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#242f3d]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#7f91a4] leading-relaxed">
              Укажите адрес сервера (Cloudflare туннель, Render или локальный IP):
            </p>

            <input
              type="text"
              value={currentServerInput}
              onChange={(e) => setCurrentServerInput(e.target.value)}
              placeholder="https://example.trycloudflare.com"
              className="w-full bg-[#242f3d] px-3.5 py-2.5 rounded-xl border border-transparent focus:border-blue-500 outline-none text-sm text-white placeholder-[#7f91a4]"
            />

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setCustomServerUrl(currentServerInput);
                  setShowServerModal(false);
                  window.location.reload();
                }}
                className="w-full py-2.5 bg-[#2481cc] hover:bg-[#1e70b3] text-white font-semibold text-sm rounded-xl transition cursor-pointer"
              >
                Сохранить и подключиться
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentServerInput(DEFAULT_ONLINE_SERVER);
                  setCustomServerUrl(DEFAULT_ONLINE_SERVER);
                  setShowServerModal(false);
                  window.location.reload();
                }}
                className="w-full py-2 bg-[#242f3d] hover:bg-[#2c3848] text-[#7f91a4] hover:text-white text-xs rounded-xl transition cursor-pointer"
              >
                Сбросить на сервер по умолчанию
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
