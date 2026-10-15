const mq = window.matchMedia('(prefers-color-scheme: dark)')

let current = { theme: 'system', accent: 'bosque' }

function paint() {
  const dark = current.theme === 'dark' || (current.theme === 'system' && mq.matches)
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.accent = current.accent || 'bosque'
  const bar = document.querySelector('meta[name="theme-color"]')
  if (bar) bar.setAttribute('content', dark ? '#141413' : '#f7f5f0')
}

mq.addEventListener('change', () => current.theme === 'system' && paint())

export function applyLook({ theme, accent }) {
  current = { theme: theme || 'system', accent: accent || 'bosque' }
  try {
    localStorage.setItem('mentodo:look', JSON.stringify(current))
  } catch {}
  paint()
}
