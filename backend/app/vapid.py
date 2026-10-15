"""Genera un par de claves VAPID para Web Push. Uso:
    docker compose exec backend python -m app.vapid
y copia las dos líneas al backend/.env."""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


key = ec.generate_private_key(ec.SECP256R1())
priv = key.private_numbers().private_value.to_bytes(32, "big")
pub = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print(f"VAPID_PUBLIC_KEY={b64(pub)}")
print(f"VAPID_PRIVATE_KEY={b64(priv)}")
