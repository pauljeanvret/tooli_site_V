export type TooliaTheme = 'light' | 'dark' | 'system'

const themeStorageKey = 'toolia_theme'

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTooliaTheme(theme: TooliaTheme) {
  if (typeof document === 'undefined') return
  const resolvedTheme = theme === 'system' ? resolveSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  document.documentElement.dataset.theme = theme
}

export function getStoredTooliaTheme(): TooliaTheme | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(themeStorageKey)
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : null
}

export function setStoredTooliaTheme(theme: TooliaTheme) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(themeStorageKey, theme)
  applyTooliaTheme(theme)
}

export function initializeTooliaTheme() {
  applyTooliaTheme(getStoredTooliaTheme() || 'light')
}

export function watchSystemTheme(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
