import mimetypes
import os
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..deps import Emitter, emitter
from ..models import Attachment, Note, User
from ..ownership import own_card
from ..serialize import attachment_out

router = APIRouter(prefix="/attachments", tags=["attachments"])

UPLOADS = Path(os.getenv("UPLOADS_DIR", "/app/uploads"))
MAX_BYTES = 25 * 1024 * 1024
# Se pueden ver en el navegador; todo lo demás se descarga (un HTML o un SVG
# abiertos «en línea» podrían ejecutar código con la sesión del usuario)
INLINE = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/heic", "application/pdf",
          "text/plain", "video/mp4", "video/quicktime", "audio/mpeg", "audio/mp4"}


def _path(a: Attachment) -> Path:
    return UPLOADS / str(a.user_id) / a.stored_name


@router.post("", status_code=201)
async def upload(file: UploadFile = File(...), card_id: int | None = Form(None), note_id: int | None = Form(None),
                 em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    if (card_id is None) == (note_id is None):
        raise HTTPException(422, "Indica una tarjeta o un apunte")
    if card_id is not None:
        own_card(db, em.user.id, card_id)
    else:
        n = db.get(Note, note_id)
        if not n or n.user_id != em.user.id:
            raise HTTPException(404, "Apunte no encontrado")
    name = os.path.basename(file.filename or "archivo")[:255] or "archivo"
    ext = Path(name).suffix.lower()[:12]
    stored = f"{secrets.token_hex(16)}{ext}"
    folder = UPLOADS / str(em.user.id)
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / stored
    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, "El archivo pasa de 25 MB")
            out.write(chunk)
    mime = file.content_type or mimetypes.guess_type(name)[0] or "application/octet-stream"
    a = Attachment(user_id=em.user.id, card_id=card_id, note_id=note_id, filename=name, mime=mime[:120],
                   size=size, stored_name=stored)
    db.add(a)
    db.commit()
    out = attachment_out(a)
    em.upsert("attachment", out)
    return out


@router.get("/{att_id}/file")
def download(att_id: int, download: bool = False, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = db.get(Attachment, att_id)
    if not a or a.user_id != user.id or not _path(a).exists():
        raise HTTPException(404, "Archivo no encontrado")
    inline = a.mime in INLINE and not download
    return FileResponse(
        _path(a), media_type=a.mime if inline else "application/octet-stream", filename=a.filename,
        content_disposition_type="inline" if inline else "attachment",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400"},
    )


@router.delete("/{att_id}")
def remove(att_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    a = db.get(Attachment, att_id)
    if not a or a.user_id != em.user.id:
        raise HTTPException(404, "Archivo no encontrado")
    _path(a).unlink(missing_ok=True)
    db.delete(a)
    db.commit()
    em.delete("attachment", att_id)
    return {"ok": True}
