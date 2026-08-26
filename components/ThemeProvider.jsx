'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
export const THEME_KEY = 'mn.theme'

export function useTheme() {
  return useContext(ThemeContext) || { theme: 'light', toggle: () => {} }
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    // The inline script in <head> has already applied the class; mirror it here.
    const current = document.documentElement.getAttribute('data-theme') || 'dark'
    setTheme(current)
  }, [])

  const apply = useCallback((next) => {
    document.documentElement.setAttribute('data-theme', next)
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private mode — the choice just will not persist */
    }
    setTheme(next)
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme: apply, toggle: () => apply(theme === 'dark' ? 'light' : 'dark') }),
    [theme, apply]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

/**
 * Recharts needs concrete colour values, not CSS variables, so the tokens are
 * resolved from the document whenever the theme flips.
 */
export function useChartTheme() {
  const { theme } = useTheme()
  const [tokens, setTokens] = useState({
    grid: '#ececed', axisText: '#96969c', axisLine: '#e5e5e6',
    panel: '#ffffff', border: '#e5e5e6', text: '#0f0f10',
    accent: '#f4511e', muted: '#6b6b70', track: '#ededee',
  })

  useEffect(() => {
    const s = getComputedStyle(document.documentElement)
    const v = (name, fallback) => s.getPropertyValue(name).trim() || fallback
    setTokens({
      grid: v('--chart-grid', '#ececed'),
      axisText: v('--faint', '#96969c'),
      axisLine: v('--border-soft', '#e5e5e6'),
      panel: v('--panel-2', '#ffffff'),
      border: v('--border', '#e5e5e6'),
      text: v('--text', '#0f0f10'),
      accent: v('--accent', '#f4511e'),
      muted: v('--muted', '#6b6b70'),
      track: v('--chart-track', '#ededee'),
    })
  }, [theme])

  return useMemo(
    () => ({
      ...tokens,
      axis: { stroke: tokens.axisLine, tick: { fill: tokens.axisText, fontSize: 11 } },
      tooltip: {
        background: tokens.panel,
        border: `1px solid ${tokens.border}`,
        borderRadius: 10,
        color: tokens.text,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      },
      legend: { fontSize: 12, color: tokens.muted },
      cursor: { fill: 'rgba(244, 81, 30, 0.08)' },
    }),
    [tokens]
  )
}
