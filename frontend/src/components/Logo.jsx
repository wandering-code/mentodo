import { useId } from 'react'

/* Monograma de Mentodo (vector de docs/brand/icono.png) */
export function Logo({ size = 24, className }) {
  const id = useId()
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="560" y1="290" x2="777" y2="640">
          <stop offset="0" stopColor="#FCF9F4" />
          <stop offset="0.35" stopColor="#E2E6C5" />
          <stop offset="0.62" stopColor="#AEC99A" />
          <stop offset="1" stopColor="#C9E4C3" />
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" rx="270" fill="#1F3228" />
      <g fill="none" strokeWidth="77" strokeLinecap="round" strokeLinejoin="round">
        <path stroke={`url(#${id})`} d="M489.5 435C489.5 345 550.5 290 632.5 290C714.5 290 777.5 345 777.5 435V705" />
        <path stroke="#FCF9F4" d="M210.5 705V435C210.5 345 272.5 290 350.5 290C428.5 290 489.5 345 489.5 435V575C489.5 665 542.5 721 607.5 721" />
      </g>
    </svg>
  )
}

/* Logotipo "mentodo" (recortado de docs/brand/logotipo.png como máscara, así
   toma el color de la tinta y funciona igual en claro y en oscuro) */
export function Wordmark({ height = 22, className }) {
  return (
    <span
      role="img"
      aria-label="mentodo"
      className={className}
      style={{
        display: 'inline-block',
        height,
        width: (height * 787) / 154,
        background: 'var(--ink)',
        WebkitMask: 'url(/wordmark.png) center / contain no-repeat',
        mask: 'url(/wordmark.png) center / contain no-repeat',
      }}
    />
  )
}
