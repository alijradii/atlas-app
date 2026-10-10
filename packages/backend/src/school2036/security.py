"""Credential primitives; tokens are never persisted in plaintext."""

import hashlib
import hmac
import secrets
from pathlib import Path

from cryptography.fernet import Fernet


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def token() -> str:
    return secrets.token_urlsafe(32)


def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    value = hashlib.scrypt(
        password.encode(), salt=salt, n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024
    )
    return f"scrypt${salt.hex()}${value.hex()}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        # Equal work for nonexistent/pending accounts.
        encoded = "scrypt$" + "00" * 16 + "$" + "00" * 64
    _, salt, expected = encoded.split("$")
    actual = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024
    )
    return hmac.compare_digest(actual.hex(), expected)


def cipher(path: Path) -> Fernet:
    return Fernet(path.read_bytes())
