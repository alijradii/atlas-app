"""Explicit upload formats and bounded, provider-free document validation."""

from __future__ import annotations

import importlib.util
import json
import shutil
import warnings
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

MAX_PAGES = 1000
MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000


@dataclass(frozen=True)
class DocumentFormat:
    extension: str
    format: str
    media_type: str
    parser: str

    @property
    def suffix(self) -> str:
        return self.extension


_SPECS = [
    (".pdf", "pdf", "application/pdf", "raganything-mineru"),
    (".txt", "text", "text/plain", "raganything-text"),
    (".md", "markdown", "text/markdown", "raganything-text"),
    (
        ".docx",
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "mineru-office",
    ),
    (
        ".pptx",
        "pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "mineru-office",
    ),
    (
        ".xlsx",
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "mineru-office",
    ),
    (".doc", "doc", "application/msword", "libreoffice-mineru"),
    (".ppt", "ppt", "application/vnd.ms-powerpoint", "libreoffice-mineru"),
    (".xls", "xls", "application/vnd.ms-excel", "libreoffice-mineru"),
    (".png", "image", "image/png", "raganything-mineru"),
    (".jpeg", "image", "image/jpeg", "raganything-mineru"),
    (".jpg", "image", "image/jpeg", "raganything-mineru"),
    (".bmp", "image", "image/bmp", "raganything-mineru"),
    (".tiff", "image", "image/tiff", "raganything-mineru"),
    (".tif", "image", "image/tiff", "raganything-mineru"),
    (".gif", "image", "image/gif", "raganything-mineru"),
    (".webp", "image", "image/webp", "raganything-mineru"),
    (".html", "html", "text/html", "safe-html"),
    (".htm", "html", "text/html", "safe-html"),
    (".xhtml", "html", "application/xhtml+xml", "safe-html"),
]
FORMATS = {row[0]: DocumentFormat(*row) for row in _SPECS}
SUPPORTED_EXTENSIONS = tuple(FORMATS)


def identify_upload(filename: str, content_type: str | None = None) -> DocumentFormat:
    """Select by an explicit suffix; an advertised MIME must agree if supplied."""
    extension = Path(filename).suffix.lower()
    if extension not in FORMATS:
        raise ValueError("unsupported_document_format: " + ", ".join(SUPPORTED_EXTENSIONS))
    info = FORMATS[extension]
    media = (content_type or "").partition(";")[0].strip().lower()
    accepted = {"", "application/octet-stream", "binary/octet-stream", info.media_type}
    if info.format in {"text", "markdown", "html"}:
        accepted.add("text/plain")
    if info.format == "markdown":
        accepted.update({"text/x-markdown", "application/markdown"})
    if info.format == "html":
        accepted.update({"text/html", "application/xhtml+xml"})
    if extension == ".bmp":
        accepted.add("image/x-ms-bmp")
    if media not in accepted:
        raise ValueError(f"document_content_type_mismatch: {extension} requires {info.media_type}")
    return info


def read_document_text(path: Path) -> str:
    """Accept UTF-8 or BOM-marked UTF-16/32; never replace undecodable bytes."""
    raw = path.read_bytes()
    encoding = "utf-8-sig"
    if raw.startswith((b"\xff\xfe\x00\x00", b"\x00\x00\xfe\xff")):
        encoding = "utf-32"
    elif raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        encoding = "utf-16"
    try:
        text = raw.decode(encoding)
    except UnicodeDecodeError as exc:
        raise ValueError("invalid_text_encoding: use UTF-8 or BOM-marked UTF-16/32") from exc
    if any(ord(char) < 32 and char not in "\n\r\t\f" for char in text):
        raise ValueError("invalid_text_content: binary control characters")
    if not text.strip():
        raise ValueError("empty_document")
    return text


def _validate_office_archive(path: Path, info: DocumentFormat) -> None:
    expected = {
        "docx": "word/document.xml",
        "pptx": "ppt/presentation.xml",
        "xlsx": "xl/workbook.xml",
    }
    try:
        with zipfile.ZipFile(path) as archive:
            members = archive.infolist()
            if len(members) > 10_000:
                raise ValueError("office_archive_too_many_members")
            if sum(member.file_size for member in members) > MAX_ARCHIVE_BYTES:
                raise ValueError("office_archive_expanded_limit")
            for member in members:
                name = PurePosixPath(member.filename.replace("\\", "/"))
                if name.is_absolute() or ".." in name.parts or ":" in member.filename:
                    raise ValueError("invalid_office_archive_path")
                if member.flag_bits & 1:
                    raise ValueError("encrypted_office_document")
                if member.file_size > 100 * 1024 * 1024:
                    raise ValueError("office_archive_member_limit")
                if member.file_size > max(1, member.compress_size) * 1000:
                    raise ValueError("office_archive_compression_limit")
                if (member.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError("invalid_office_archive_symlink")
            names = {member.filename for member in members}
            if not {"[Content_Types].xml", expected[info.format]}.issubset(names):
                raise ValueError("invalid_office_document_structure")
            if len(names) != len(members):
                raise ValueError("invalid_office_archive_duplicate_members")
            if archive.testzip() is not None:
                raise ValueError("invalid_office_archive_crc")
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as exc:
        raise ValueError("invalid_office_archive") from exc


def validate_upload(path: Path, info: DocumentFormat) -> dict:
    """Validate bounded input without executing parsers or opening remote assets.

    The caller caps the raw upload at 100 MiB. Physical PDF pages are checked
    before extraction; other formats receive logical locations during parsing.
    """
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError("empty_document")
    metadata = {"page_basis": "physical" if info.format == "pdf" else "logical"}
    if info.format == "pdf":
        from pypdf import PdfReader

        try:
            with path.open("rb") as stream:
                if not stream.read(1024).lstrip().startswith(b"%PDF-"):
                    raise ValueError("invalid_pdf_signature")
            reader = PdfReader(path)
            if reader.is_encrypted:
                raise ValueError("encrypted_pdf")
            pages = len(reader.pages)
            if not 1 <= pages <= MAX_PAGES:
                raise ValueError("document_page_limit: expected 1..1000 pages")
            metadata["pages"] = pages
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("invalid_pdf") from exc
    elif info.format in {"text", "markdown", "html"}:
        read_document_text(path)
    elif info.parser == "mineru-office":
        _validate_office_archive(path, info)
    elif info.parser == "libreoffice-mineru":
        with path.open("rb") as stream:
            if stream.read(8) != b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
                raise ValueError("invalid_legacy_office_signature")
    elif info.format == "image":
        from PIL import Image

        expected = {".jpg": "JPEG", ".jpeg": "JPEG", ".tif": "TIFF", ".tiff": "TIFF"}
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(path) as image:
                    if image.format != expected.get(info.extension, info.extension[1:].upper()):
                        raise ValueError("image_content_type_mismatch")
                    frames = getattr(image, "n_frames", 1)
                    if frames > MAX_PAGES:
                        raise ValueError("image_pixel_or_frame_limit")
                    image.verify()
                    metadata["pages"] = frames
                with Image.open(path) as image:
                    pixels = 0
                    for index in range(frames):
                        image.seek(index)
                        pixels += image.width * image.height
                        if pixels > MAX_IMAGE_PIXELS:
                            raise ValueError("image_pixel_or_frame_limit")
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("invalid_image") from exc
    return metadata


def parser_requirements(info: DocumentFormat, mineru_config: Path | None) -> list[str]:
    """Report missing local capabilities before accepting an expensive parse job."""
    missing = []
    if info.parser != "safe-html" and importlib.util.find_spec("raganything") is None:
        missing.append("Install the pinned RAG-Anything runtime requirements.")
    if info.parser in {"raganything-mineru", "libreoffice-mineru"}:
        if mineru_config is None or not Path(mineru_config).is_file():
            missing.append("Prepare MinerU models and set MINERU_TOOLS_CONFIG_JSON.")
        else:
            try:
                config = json.loads(Path(mineru_config).read_text())
                pipeline = config.get("models-dir", {}).get("pipeline")
                if not pipeline or not Path(pipeline).is_dir():
                    missing.append(
                        "MinerU config must reference an existing local pipeline model directory."
                    )
            except (ValueError, AttributeError, TypeError):
                missing.append(
                    "MINERU_TOOLS_CONFIG_JSON must contain valid MinerU configuration JSON."
                )
    if info.parser == "libreoffice-mineru" and not (
        shutil.which("libreoffice") or shutil.which("soffice")
    ):
        missing.append("Install LibreOffice for legacy DOC/PPT/XLS conversion.")
    if info.parser == "mineru-office" and importlib.util.find_spec("mineru") is None:
        missing.append("Install the pinned MinerU runtime for native DOCX/PPTX/XLSX parsing.")
    return missing
