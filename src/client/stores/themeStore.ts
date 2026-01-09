import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'agentboard-theme',
    }
  )
)

// Terminal theme configurations for xterm.js
export const terminalThemes = {
  dark: {
    background: '#0a0a0a',
    foreground: '#e5e5e5',
    cursor: '#3b82f6',
    cursorAccent: '#0a0a0a',
    selectionBackground: 'rgba(59, 130, 246, 0.3)',
    selectionForeground: '#ffffff',
    black: '#171717',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#e5e5e5',
    brightBlack: '#525252',
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#fbbf24',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#ffffff',
  },
  light: {
    background: '#fafafa',
    foreground: '#171717',
    cursor: '#2563eb',
    cursorAccent: '#fafafa',
    selectionBackground: 'rgba(37, 99, 235, 0.2)',
    selectionForeground: '#000000',
    black: '#171717',
    red: '#dc2626',
    green: '#16a34a',
    yellow: '#ca8a04',
    blue: '#2563eb',
    magenta: '#9333ea',
    cyan: '#0891b2',
    white: '#f5f5f5',
    brightBlack: '#737373',
    brightRed: '#ef4444',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#a855f7',
    brightCyan: '#06b6d4',
    brightWhite: '#ffffff',
  },
}
