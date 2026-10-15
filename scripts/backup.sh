#!/bin/bash
# Copia de seguridad diaria de Mentodo en el mini PC (cron, 4:15).
# Mismo patrón que Puchi: volcado de Postgres (+ adjuntos cuando existan) en
# el disco local y copia en el pendrive de /mnt/backups. Si algo falla, avisa
# al administrador con una notificación de la propia app.
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR=/home/wander/apps/mentodo
LOCAL_DIR="$APP_DIR/backend/backups"
USB_DIR=/mnt/backups/mentodo
LOG="$APP_DIR/backup.log"
RETENTION_DAYS=30
COMPOSE="docker-compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.prod.yml"

notify_fail() {
  echo "$(date "+%F %T"): ERROR - $1" >> "$LOG"
  # Aviso dentro de Mentodo (y push si está activado) para el administrador
  $COMPOSE exec -T backend python -c "
from app.db import SessionLocal
from app.models import User
from app.notify import create_notification
from datetime import date
with SessionLocal() as db:
    for u in db.query(User).filter(User.is_admin.is_(True)):
        create_notification(db, u.id, f'backup-fail:{date.today()}', 'La copia de seguridad ha fallado', '''$1''', url='/ajustes')
" >/dev/null 2>&1 || true
}
trap 'notify_fail "Fallo inesperado en la línea $LINENO del script de copias"' ERR

mkdir -p "$LOCAL_DIR"
DUMP="$LOCAL_DIR/mentodo_prod_${DATE}.dump"
$COMPOSE exec -T db pg_dump -U mentodo -Fc mentodo > "$DUMP"

# Un volcado vacío o truncado no cuenta como copia
if [ ! -s "$DUMP" ] || ! $COMPOSE exec -T db pg_restore --list < "$DUMP" > /dev/null 2>&1; then
  notify_fail "El volcado de la base de datos está vacío o no se puede leer"
  exit 1
fi

FILES=("$DUMP")
if [ -d "$APP_DIR/backend/uploads" ] && [ -n "$(ls -A "$APP_DIR/backend/uploads" 2>/dev/null)" ]; then
  UP="$LOCAL_DIR/mentodo_uploads_${DATE}.tar.gz"
  tar -czf "$UP" -C "$APP_DIR/backend" uploads
  FILES+=("$UP")
fi

if mountpoint -q /mnt/backups; then
  mkdir -p "$USB_DIR"
  cp "${FILES[@]}" "$USB_DIR/"
  find "$USB_DIR" -name "mentodo_*" -mtime +$RETENTION_DAYS -delete
else
  notify_fail "El pendrive de /mnt/backups no está montado: la copia solo está en el disco del mini PC"
fi

find "$LOCAL_DIR" -name "mentodo_*" -mtime +$RETENTION_DAYS -delete
echo "$(date "+%F %T"): copia completada (${DATE}, $(du -h "$DUMP" | cut -f1))" >> "$LOG"
