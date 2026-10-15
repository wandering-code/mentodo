import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/* Abrir y cerrar una tarjeta vive en la URL (?card=…): así se puede enlazar,
   y el gesto de volver del móvil la cierra. Al abrirla desde dentro de la app
   se marca en el estado de la entrada, y cerrarla deshace esa entrada (en vez
   de dejar una "atrás" que la volvería a abrir). */
export function useCardNav() {
  const nav = useNavigate()
  const loc = useLocation()

  const open = useCallback(
    (card) => {
      const p = new URLSearchParams(loc.search)
      p.set('card', card.id)
      nav({ pathname: loc.pathname, search: `?${p}` }, { state: { cardFromApp: true } })
    },
    [nav, loc.pathname, loc.search],
  )

  const close = useCallback(() => {
    if (loc.state?.cardFromApp) return nav(-1)
    const p = new URLSearchParams(loc.search)
    p.delete('card')
    nav({ pathname: loc.pathname, search: p.size ? `?${p}` : '' }, { replace: true })
  }, [nav, loc])

  return { open, close }
}

export function cardPath(card) {
  return card.project_id ? `/p/${card.project_id}?card=${card.id}` : `/inbox?card=${card.id}`
}
