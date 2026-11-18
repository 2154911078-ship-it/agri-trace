type Kind = 'ok' | 'warn' | 'error'

let host: HTMLDivElement | null = null

function ensureHost() {
  if (host) return host
  host = document.createElement('div')
  host.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:36px', 'transform:translateX(-50%)',
    'display:flex', 'flex-direction:column', 'gap:8px', 'z-index:9999',
    'pointer-events:none',
  ].join(';')
  document.body.appendChild(host)
  return host
}

export function toast(msg: string, kind: Kind = 'ok') {
  const el = document.createElement('div')
  const color = kind === 'error' ? '#b4462f' : kind === 'warn' ? '#c9a45c' : '#2f5d50'
  el.textContent = msg
  el.style.cssText = [
    'font-family:inherit', 'font-size:12.5px', 'line-height:1.5',
    'color:#1a1d1b', 'background:#f7f6f2', 'padding:10px 16px',
    `border-left:2px solid ${color}`, 'border-radius:4px',
    'box-shadow:0 8px 24px rgba(26,29,27,.14)',
    'opacity:0', 'transform:translateY(6px)',
    'transition:all .18s cubic-bezier(.2,.8,.2,1)',
  ].join(';')
  ensureHost().appendChild(el)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(-4px)'
    setTimeout(() => el.remove(), 220)
  }, 2200)
}