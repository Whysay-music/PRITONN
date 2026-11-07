export interface AppTheme {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    accentHover: string;
    bg: string;
    sidebar: string;
    surface: string;
    surfaceHover: string;
    border: string;
    borderAccent: string;
    cardBorder: string;
    glowColor: string;
    bubbleIn: string;
    bubbleOut: string;
    bubbleInText: string;
    bubbleOutText: string;
    bubbleInMeta: string;
    bubbleOutMeta: string;
    text: string;
    textMuted: string;
    gradientMain: string;
    gradientHeader: string;
    windowBorder: string;
  };
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'neon-blue',
    name: 'Классический Неон',
    isDark: true,
    colors: {
      primary: '#2481cc',
      secondary: '#185a9d',
      accent: '#2481cc',
      accentHover: '#1c6cae',
      bg: '#0e1621',
      sidebar: '#17212b',
      surface: '#242f3d',
      surfaceHover: '#202b36',
      border: '#101921',
      borderAccent: '#5288c1',
      cardBorder: 'rgba(82, 136, 193, 0.25)',
      glowColor: 'rgba(36, 129, 204, 0.35)',
      bubbleIn: '#182533',
      bubbleOut: '#2b5278',
      bubbleInText: '#f5f5f5',
      bubbleOutText: '#ffffff',
      bubbleInMeta: '#7f91a4',
      bubbleOutMeta: 'rgba(255, 255, 255, 0.75)',
      text: '#f5f5f5',
      textMuted: '#7f91a4',
      gradientMain: 'linear-gradient(135deg, #2481cc 0%, #175d97 100%)',
      gradientHeader: 'linear-gradient(135deg, #1f2b38 0%, #16222f 100%)',
      windowBorder: '#1c2936',
    },
  },
  {
    id: 'matrix-emerald',
    name: 'Киберпанк Изумруд',
    isDark: true,
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#10b981',
      accentHover: '#059669',
      bg: '#09130f',
      sidebar: '#0f1f1a',
      surface: '#152b24',
      surfaceHover: '#1b372e',
      border: '#112920',
      borderAccent: '#34d399',
      cardBorder: 'rgba(16, 185, 129, 0.3)',
      glowColor: 'rgba(16, 185, 129, 0.4)',
      bubbleIn: '#12241e',
      bubbleOut: '#165e49',
      bubbleInText: '#f0fdf4',
      bubbleOutText: '#ffffff',
      bubbleInMeta: '#6ee7b7',
      bubbleOutMeta: 'rgba(240, 253, 244, 0.85)',
      text: '#ecfdf5',
      textMuted: '#6ee7b7',
      gradientMain: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      gradientHeader: 'linear-gradient(135deg, #132b22 0%, #0c1a14 100%)',
      windowBorder: '#164e3c',
    },
  },
  {
    id: 'royal-amethyst',
    name: 'Королевский Аметист',
    isDark: true,
    colors: {
      primary: '#a855f7',
      secondary: '#7c3aed',
      accent: '#a855f7',
      accentHover: '#9333ea',
      bg: '#0f0a1c',
      sidebar: '#17102b',
      surface: '#241a42',
      surfaceHover: '#2d2153',
      border: '#1d1336',
      borderAccent: '#c084fc',
      cardBorder: 'rgba(168, 85, 247, 0.3)',
      glowColor: 'rgba(168, 85, 247, 0.4)',
      bubbleIn: '#1a1332',
      bubbleOut: '#5b21b6',
      bubbleInText: '#faf5ff',
      bubbleOutText: '#ffffff',
      bubbleInMeta: '#d8b4fe',
      bubbleOutMeta: 'rgba(250, 245, 255, 0.85)',
      text: '#faf5ff',
      textMuted: '#c084fc',
      gradientMain: 'linear-gradient(135deg, #7c3aed 0%, #c084fc 100%)',
      gradientHeader: 'linear-gradient(135deg, #24143f 0%, #130a24 100%)',
      windowBorder: '#3b2269',
    },
  },
  {
    id: 'sunset-crimson',
    name: 'Закатный Рубин',
    isDark: true,
    colors: {
      primary: '#f43f5e',
      secondary: '#e11d48',
      accent: '#f43f5e',
      accentHover: '#e11d48',
      bg: '#160a0f',
      sidebar: '#220f18',
      surface: '#331624',
      surfaceHover: '#421d2f',
      border: '#290f1d',
      borderAccent: '#fb7185',
      cardBorder: 'rgba(244, 63, 94, 0.3)',
      glowColor: 'rgba(244, 63, 94, 0.4)',
      bubbleIn: '#26111b',
      bubbleOut: '#881337',
      bubbleInText: '#fff1f2',
      bubbleOutText: '#ffffff',
      bubbleInMeta: '#fda4af',
      bubbleOutMeta: 'rgba(255, 241, 242, 0.85)',
      text: '#fff1f2',
      textMuted: '#fda4af',
      gradientMain: 'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)',
      gradientHeader: 'linear-gradient(135deg, #381224 0%, #1a0812 100%)',
      windowBorder: '#5b1532',
    },
  },
  {
    id: 'oceanic-teal',
    name: 'Морская Бездна',
    isDark: true,
    colors: {
      primary: '#06b6d4',
      secondary: '#0891b2',
      accent: '#06b6d4',
      accentHover: '#0891b2',
      bg: '#08141b',
      sidebar: '#0d1f2a',
      surface: '#152f3f',
      surfaceHover: '#1c3d52',
      border: '#112735',
      borderAccent: '#22d3ee',
      cardBorder: 'rgba(6, 182, 212, 0.3)',
      glowColor: 'rgba(6, 182, 212, 0.38)',
      bubbleIn: '#0f2430',
      bubbleOut: '#155e75',
      bubbleInText: '#ecfeff',
      bubbleOutText: '#ffffff',
      bubbleInMeta: '#67e8f9',
      bubbleOutMeta: 'rgba(236, 254, 255, 0.85)',
      text: '#ecfeff',
      textMuted: '#67e8f9',
      gradientMain: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
      gradientHeader: 'linear-gradient(135deg, #132e3d 0%, #0a1820 100%)',
      windowBorder: '#164860',
    },
  },
  {
    id: 'obsidian-oled',
    name: 'OLED Обсидиан',
    isDark: true,
    colors: {
      primary: '#38bdf8',
      secondary: '#0284c7',
      accent: '#38bdf8',
      accentHover: '#0ea5e9',
      bg: '#000000',
      sidebar: '#0a0a0a',
      surface: '#141414',
      surfaceHover: '#1f1f1f',
      border: '#1e1e1e',
      borderAccent: '#475569',
      cardBorder: 'rgba(255, 255, 255, 0.15)',
      glowColor: 'rgba(56, 189, 248, 0.3)',
      bubbleIn: '#121212',
      bubbleOut: '#1e293b',
      bubbleInText: '#f8fafc',
      bubbleOutText: '#ffffff',
      bubbleInMeta: '#94a3b8',
      bubbleOutMeta: 'rgba(248, 250, 252, 0.8)',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      gradientMain: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
      gradientHeader: 'linear-gradient(135deg, #171717 0%, #050505 100%)',
      windowBorder: '#2e2e2e',
    },
  },
  {
    id: 'snow-glass',
    name: 'Светлый Снег',
    isDark: false,
    colors: {
      primary: '#2563eb',
      secondary: '#3b82f6',
      accent: '#2563eb',
      accentHover: '#1d4ed8',
      bg: '#f1f5f9',
      sidebar: '#ffffff',
      surface: '#f8fafc',
      surfaceHover: '#e2e8f0',
      border: '#cbd5e1',
      borderAccent: '#3b82f6',
      cardBorder: 'rgba(37, 99, 235, 0.2)',
      glowColor: 'rgba(37, 99, 235, 0.25)',
      bubbleIn: '#ffffff',
      bubbleOut: '#dbeafe',
      bubbleInText: '#0f172a',
      bubbleOutText: '#1e3a8a',
      bubbleInMeta: '#64748b',
      bubbleOutMeta: '#1d4ed8',
      text: '#0f172a',
      textMuted: '#64748b',
      gradientMain: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
      gradientHeader: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
      windowBorder: '#cbd5e1',
    },
  },
];

export const getThemeById = (id: string): AppTheme => {
  return APP_THEMES.find((t) => t.id === id) || APP_THEMES[0];
};

export const getSavedThemeId = (): string => {
  if (typeof window === 'undefined') return 'neon-blue';
  const saved = localStorage.getItem('pritonn_theme_id');
  if (saved && APP_THEMES.some((t) => t.id === saved)) {
    return saved;
  }
  // Fallback to is_dark check
  const isDarkSaved = localStorage.getItem('pritonn_is_dark');
  if (isDarkSaved === 'false') return 'snow-glass';
  return 'neon-blue';
};

export const applyThemeToDocument = (themeId: string): AppTheme => {
  const theme = getThemeById(themeId);
  if (typeof document === 'undefined') return theme;

  const root = document.documentElement;

  // Apply CSS custom properties
  root.style.setProperty('--tg-bg', theme.colors.bg);
  root.style.setProperty('--tg-sidebar', theme.colors.sidebar);
  root.style.setProperty('--tg-surface', theme.colors.surface);
  root.style.setProperty('--tg-surface-hover', theme.colors.surfaceHover);
  root.style.setProperty('--tg-accent', theme.colors.accent);
  root.style.setProperty('--tg-accent-hover', theme.colors.accentHover);
  root.style.setProperty('--tg-border', theme.colors.border);
  root.style.setProperty('--tg-border-accent', theme.colors.borderAccent);
  root.style.setProperty('--tg-card-border', theme.colors.cardBorder);
  root.style.setProperty('--tg-glow-color', theme.colors.glowColor);
  root.style.setProperty('--tg-bubble-in', theme.colors.bubbleIn);
  root.style.setProperty('--tg-bubble-out', theme.colors.bubbleOut);
  root.style.setProperty('--tg-bubble-in-text', theme.colors.bubbleInText);
  root.style.setProperty('--tg-bubble-out-text', theme.colors.bubbleOutText);
  root.style.setProperty('--tg-bubble-in-meta', theme.colors.bubbleInMeta);
  root.style.setProperty('--tg-bubble-out-meta', theme.colors.bubbleOutMeta);
  root.style.setProperty('--tg-text', theme.colors.text);
  root.style.setProperty('--tg-text-muted', theme.colors.textMuted);
  root.style.setProperty('--tg-gradient-main', theme.colors.gradientMain);
  root.style.setProperty('--tg-gradient-header', theme.colors.gradientHeader);
  root.style.setProperty('--tg-window-border', theme.colors.windowBorder);

  // Toggle light-theme class
  if (theme.isDark) {
    root.classList.remove('light-theme');
    document.body.classList.remove('light-theme');
  } else {
    root.classList.add('light-theme');
    document.body.classList.add('light-theme');
  }

  // Set theme color meta tag
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme.colors.bg);
  }

  localStorage.setItem('pritonn_theme_id', theme.id);
  localStorage.setItem('pritonn_is_dark', String(theme.isDark));

  window.dispatchEvent(new CustomEvent('pritonn-theme-changed', { detail: theme }));
  return theme;
};
