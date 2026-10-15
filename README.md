# Mentodo

Organizador personal estilo Notion, hecho a medida: proyectos con tarjetas, etiquetas
agrupadas (Estado, Prioridad…), vistas de tablero, tabla, lista y calendario, un To Do general
que reúne lo marcado de todos los proyectos, bandeja de captura rápida (⌘K), avisos por fecha o
por etiqueta (Web Push) y sincronización en tiempo real entre todos los dispositivos del perfil.
Las cuentas nuevas necesitan aprobación del administrador.

**Stack**: FastAPI + Postgres + WebSockets (backend, Docker) · React 19 + Vite + Tailwind 4 +
Motion + dnd-kit + TipTap (frontend, PWA estática servida por nginx).

## Cómo arrancar en local

```bash
cd ~/repos/mentodo
cp backend/.env.example backend/.env   # primera vez: rellena SECRET_KEY y ADMIN_PASSWORD
docker compose up --build -d            # backend en :8005, Postgres en :5437
docker compose exec backend python -m app.vapid   # primera vez: claves de Web Push → backend/.env
cd frontend && npm install && npm run dev        # http://<ip-lan>:5180
```

La cuenta de administración (`ADMIN_USERNAME` / `ADMIN_PASSWORD` del `.env`) se crea sola al
arrancar el backend. Las migraciones (Alembic) también se aplican solas al arrancar.

Nueva migración tras cambiar `backend/app/models.py`:
`docker compose exec backend alembic revision --autogenerate -m "..."`.

## Despliegue en producción (mini PC)

Checklist general en `~/repos/dev-standards/CLAUDE.md` sección 6. Específico de Mentodo:

- Puertos: nginx **3012** (público) → backend **8005** (solo `127.0.0.1`). Postgres no se publica.
- `backend/.env` en el mini PC con `COOKIE_SECURE=true` (se sirve por HTTPS vía Cloudflare).
- nginx: `root .../frontend/dist`, `/api/` → `http://localhost:8005/`, `/ws` con upgrade de
  WebSocket y `sw.js` / `manifest.webmanifest` sin caché (mismo patrón que Puchi).
- Los avisos push solo funcionan por HTTPS (no en la IP local). En iPhone, además, hay que
  añadir la app a la pantalla de inicio.

## Marca

Originales del logo en `docs/brand/`. El monograma está redibujado en vector en
`frontend/public/logo.svg` (y `src/components/Logo.jsx`); los iconos PNG de la PWA salen de ahí.

---

Pendientes, cosas probadas/descartadas y decisiones de diseño de este proyecto viven en
[GitHub Issues](../../issues) de este repo, no en este archivo — ver
`~/repos/dev-standards/CLAUDE.md` sección 8.
