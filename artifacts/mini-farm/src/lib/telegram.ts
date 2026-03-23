/**
 * Utility to interface with Telegram Web App API.
 * Provides fallbacks for local browser testing.
 */

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface WebAppInitData {
  user?: TelegramUser;
  start_param?: string;
  auth_date?: number;
  hash?: string;
}

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  section_separator_color?: string;
}

interface TelegramWebApp {
  initDataUnsafe: WebAppInitData;
  colorScheme?: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  requestFullscreen?: () => void;
  isFullscreen?: boolean;
  enableClosingConfirmation?: () => void;
  disableVerticalSwipes?: () => void;
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export const getTelegramContext = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

export const getTelegramUser = (): { id: string; username: string; firstName: string } => {
  const tg = getTelegramContext();
  const user = tg?.initDataUnsafe?.user;
  if (user?.id) {
    return {
      id: String(user.id),
      username: user.username ?? "",
      firstName: user.first_name ?? "",
    };
  }
  const localId = localStorage.getItem("demo_telegram_id") ?? (() => {
    const id = "demo_" + Math.floor(Math.random() * 10000);
    localStorage.setItem("demo_telegram_id", id);
    return id;
  })();
  return { id: localId, username: "", firstName: "Тестовый" };
};

export const getTelegramId = (): string => {
  const tg = getTelegramContext();
  if (tg?.initDataUnsafe?.user?.id) {
    return String(tg.initDataUnsafe.user.id);
  }
  const localId = localStorage.getItem('demo_telegram_id');
  if (localId) return localId;
  const newId = 'demo_' + Math.floor(Math.random() * 10000);
  localStorage.setItem('demo_telegram_id', newId);
  return newId;
};

export const hapticFeedback = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
  const tg = getTelegramContext();
  if (!tg) return;
  if (type === 'success' || type === 'error') {
    tg.HapticFeedback.notificationOccurred(type);
  } else {
    tg.HapticFeedback.impactOccurred(type);
  }
};

/**
 * Parse a hex color (#rrggbb) to HSL string "H S% L%".
 * Used to map Telegram theme params to our HSL CSS variables.
 */
function hexToHsl(hex: string): string | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Apply Telegram's themeParams to our CSS custom properties.
 * This makes the app follow the user's Telegram color scheme exactly.
 */
function applyTelegramTheme(tg: TelegramWebApp) {
  const root = document.documentElement;
  const p = tg.themeParams ?? {};
  const isDark = tg.colorScheme === 'dark';

  // Toggle dark class for Tailwind dark: variants
  root.classList.toggle('dark', isDark);

  // Apply Telegram's raw hex colors as CSS vars for direct use
  const rawVars: Record<string, string | undefined> = {
    '--tg-bg': p.bg_color,
    '--tg-text': p.text_color,
    '--tg-hint': p.hint_color,
    '--tg-link': p.link_color,
    '--tg-button': p.button_color,
    '--tg-button-text': p.button_text_color,
    '--tg-secondary-bg': p.secondary_bg_color,
    '--tg-header-bg': p.header_bg_color,
    '--tg-bottom-bar-bg': p.bottom_bar_bg_color,
    '--tg-accent': p.accent_text_color,
    '--tg-section-bg': p.section_bg_color,
    '--tg-section-header': p.section_header_text_color,
    '--tg-subtitle': p.subtitle_text_color,
    '--tg-destructive': p.destructive_text_color,
    '--tg-separator': p.section_separator_color,
  };
  for (const [key, val] of Object.entries(rawVars)) {
    if (val) root.style.setProperty(key, val);
  }

  // Map Telegram colors to our HSL design system variables
  const bgHsl = p.bg_color ? hexToHsl(p.bg_color) : null;
  const textHsl = p.text_color ? hexToHsl(p.text_color) : null;
  const hintHsl = p.hint_color ? hexToHsl(p.hint_color) : null;
  const secBgHsl = p.secondary_bg_color ? hexToHsl(p.secondary_bg_color) : null;
  const btnHsl = p.button_color ? hexToHsl(p.button_color) : null;
  const headerHsl = (p.header_bg_color || p.bg_color) ? hexToHsl(p.header_bg_color ?? p.bg_color!) : null;
  const sectionBgHsl = (p.section_bg_color || p.secondary_bg_color) ? hexToHsl(p.section_bg_color ?? p.secondary_bg_color!) : null;

  if (bgHsl) {
    root.style.setProperty('--background', bgHsl);
    root.style.setProperty('--card', bgHsl);
    root.style.setProperty('--popover', bgHsl);
  }
  if (secBgHsl || sectionBgHsl) {
    const mutedHsl = sectionBgHsl ?? secBgHsl;
    if (mutedHsl) {
      root.style.setProperty('--muted', mutedHsl);
      root.style.setProperty('--card', mutedHsl);
    }
  }
  if (headerHsl) {
    root.style.setProperty('--card', headerHsl);
    root.style.setProperty('--popover', headerHsl);
  }
  if (textHsl) {
    root.style.setProperty('--foreground', textHsl);
    root.style.setProperty('--card-foreground', textHsl);
    root.style.setProperty('--popover-foreground', textHsl);
  }
  if (hintHsl) {
    root.style.setProperty('--muted-foreground', hintHsl);
  }
  if (btnHsl) {
    root.style.setProperty('--primary', btnHsl);
    root.style.setProperty('--ring', btnHsl);
  }

  // Nav bar colors (bottom)
  const navBg = p.bottom_bar_bg_color ?? p.secondary_bg_color ?? p.bg_color;
  if (navBg) {
    root.style.setProperty('--nav-bg', `${navBg}f5`);
  }
  const sepColor = p.section_separator_color ?? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)');
  root.style.setProperty('--nav-border', sepColor);

  // Set header / bottom bar colors in Telegram UI
  try {
    if (tg.setHeaderColor && (p.bg_color || p.header_bg_color)) {
      tg.setHeaderColor(p.header_bg_color ?? p.bg_color!);
    }
    if (tg.setBackgroundColor && (p.secondary_bg_color ?? p.bg_color)) {
      tg.setBackgroundColor(p.secondary_bg_color ?? p.bg_color!);
    }
  } catch {
    // older clients
  }
}

/**
 * Update --app-height using Telegram's stable viewport height if available.
 * We deliberately avoid window.innerHeight on mobile because it shrinks when
 * the virtual keyboard opens, causing the layout to collapse. If no Telegram
 * context is available we fall back to the CSS `100svh` (small viewport height)
 * which excludes the browser chrome and stays stable.
 */
export function updateAppHeight() {
  const tg = getTelegramContext();

  if (tg?.viewportStableHeight && tg.viewportStableHeight > 100) {
    document.documentElement.style.setProperty('--app-height', `${tg.viewportStableHeight}px`);
    return;
  }

  // Non-Telegram or Telegram hasn't supplied stable height yet.
  // Use svh/dvh cascade: svh is smaller (excludes browser chrome) and stable.
  // Inline style fallback: screen.height gives the physical device height.
  const cssH = window.innerHeight > 100 ? `${window.innerHeight}px` : '100svh';
  document.documentElement.style.setProperty('--app-height', cssH);
}

export const initTelegramApp = () => {
  const tg = getTelegramContext();
  if (tg) {
    tg.ready();

    // Expand to full screen immediately — critical for correct viewport height
    try { tg.expand(); } catch { /* older clients */ }

    try {
      if (typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
      }
    } catch { /* not supported */ }

    try {
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }
    } catch { /* not supported */ }

    // Apply initial theme
    applyTelegramTheme(tg);

    // Listen for theme changes (user switches Telegram dark/light mode)
    const onThemeChanged = () => applyTelegramTheme(tg);
    tg.onEvent('themeChanged', onThemeChanged);

    // Listen for viewport changes — only update when height is stable
    const onViewportChanged = () => {
      // Use rAF to let Telegram settle the viewport before measuring
      requestAnimationFrame(() => updateAppHeight());
    };
    tg.onEvent('viewportChanged', onViewportChanged);

  } else {
    // No Telegram — apply dark if system prefers dark
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    });
  }

  // Set initial height immediately, then again after 300ms to catch late Telegram init
  updateAppHeight();
  setTimeout(updateAppHeight, 300);
  window.addEventListener('resize', updateAppHeight, { passive: true });
};
