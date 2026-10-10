"""Isolated local extraction for supported uploads; no model-provider calls."""

from __future__ import annotations

import html
import json
import os
import sys
from html.parser import HTMLParser
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag_service.documents import (  # noqa: E402
    MAX_PAGES,
    identify_upload,
    read_document_text,
    validate_upload,
)


class SafeHTMLBlocks(HTMLParser):
    """Extract document text/structure without rendering or resolving any URLs."""

    boundaries = {"p", "div", "section", "article", "blockquote", "header", "footer", "main"}
    ignored = {"script", "style", "head", "template", "noscript", "iframe", "object"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.parts = []
        self.hidden = []
        self.heading = None
        self.pre = False
        self.list_item = False
        self.table = None
        self.table_depth = 0
        self.row = None
        self.cell = None
        self.cell_tag = "td"

    def flush(self):
        text = "".join(self.parts)
        if not self.pre:
            text = " ".join(text.split())
        self.parts = []
        if text.strip():
            block = {"type": "text", "text": text if self.pre else text.strip(), "page_idx": 0}
            if self.heading:
                block["text_level"] = self.heading
            if self.pre:
                block["block_kind"] = "code"
            if self.list_item:
                block["block_kind"] = "list"
                block["text"] = "- " + block["text"]
            self.blocks.append(block)

    def handle_starttag(self, tag, attrs):
        if self.hidden:
            if tag in self.ignored:
                self.hidden.append(tag)
            return
        if tag in self.ignored:
            self.hidden.append(tag)
            return
        if tag == "table" and self.table is None:
            self.flush()
            self.table = []
            self.table_depth = 1
        elif self.table is not None:
            if tag == "table":
                self.table_depth += 1
            if self.table_depth > 1:
                if self.cell is not None and tag in {"td", "th", "tr", "table"}:
                    self.cell.append(" ")
                return
            if tag == "tr":
                self.close_row()
                self.row = []
            elif tag in {"td", "th"}:
                self.close_cell()
                self.cell = []
                self.cell_tag = tag
            elif (tag == "br" or tag in self.boundaries) and self.cell is not None:
                self.cell.append("\n")
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.flush()
            self.heading = int(tag[1])
        elif tag in self.boundaries or tag in {"pre", "li"}:
            self.flush()
            self.pre = tag == "pre"
            self.list_item = tag == "li"
        elif tag == "br":
            self.parts.append("\n")
        elif tag == "img":
            alt = dict(attrs).get("alt")
            if alt:
                self.parts.append(alt)

    def handle_endtag(self, tag):
        if self.hidden:
            if tag == self.hidden[-1]:
                self.hidden.pop()
            return
        if self.table is not None:
            if self.table_depth > 1:
                if tag == "table":
                    self.table_depth -= 1
                if self.cell is not None and tag in {"td", "th", "tr", "table"}:
                    self.cell.append(" ")
                return
            if tag in {"td", "th"}:
                self.close_cell()
            elif tag == "tr":
                self.close_row()
            elif tag == "table":
                self.close_table()
            return
        if tag in self.boundaries or tag in {"pre", "li", "h1", "h2", "h3", "h4", "h5", "h6"}:
            self.flush()
            if tag.startswith("h") and len(tag) == 2 and tag[1].isdigit():
                self.heading = None
            if tag == "pre":
                self.pre = False
            if tag == "li":
                self.list_item = False

    def handle_data(self, data):
        if self.hidden:
            return
        if self.table is not None:
            if self.cell is not None:
                self.cell.append(data)
        else:
            self.parts.append(data)

    def finish(self):
        self.close()
        self.close_table()
        self.flush()
        return self.blocks

    def close_cell(self):
        if self.cell is not None:
            text = " ".join("".join(self.cell).split())
            if self.row is None:
                self.row = []
            self.row.append(f"<{self.cell_tag}>{html.escape(text)}</{self.cell_tag}>")
            self.cell = None

    def close_row(self):
        self.close_cell()
        if self.row is not None and self.table is not None:
            self.table.append("<tr>" + "".join(self.row) + "</tr>")
            self.row = None

    def close_table(self):
        self.close_row()
        if self.table is not None:
            self.blocks.append(
                {
                    "type": "table",
                    "table_body": "<table>" + "".join(self.table) + "</table>",
                    "page_idx": 0,
                }
            )
            self.table = None
            self.table_depth = 0


def _parse_text(path: Path, markdown: bool) -> list[dict]:
    from raganything.parser import Parser

    class UploadedTextParser(Parser):
        @classmethod
        def _resolve_md_image(cls, target, source_dir):
            # Even absolute image references must remain literal upload text.
            return None

    return UploadedTextParser._text_to_content_blocks(
        read_document_text(path), is_markdown=markdown, source_dir=None
    )


def _parse_office(path: Path, output: Path, format_name: str) -> list[dict]:
    from mineru.backend.office.office_middle_json_mkcontent import union_make
    from mineru.data.data_reader_writer import FileBasedDataWriter
    from mineru.utils.enum_class import MakeMode

    if format_name == "docx":
        from mineru.backend.office.docx_analyze import office_docx_analyze as analyze
    elif format_name == "pptx":
        from mineru.backend.office.pptx_analyze import office_pptx_analyze as analyze
    else:
        from mineru.backend.office.xlsx_analyze import office_xlsx_analyze as analyze
    images = output / "images"
    images.mkdir(parents=True, exist_ok=True)
    middle, _ = analyze(path.read_bytes(), image_writer=FileBasedDataWriter(str(images)))
    return union_make(middle["pdf_info"], MakeMode.CONTENT_LIST, str(images))


def _parse_mineru(path: Path, output: Path, format_name: str) -> tuple[list[dict], Path | None]:
    from raganything.parser import get_parser

    parser = get_parser("mineru")
    kwargs = {"backend": "pipeline", "formula": False, "table": True, "timeout": 3500}
    preview = None
    if format_name in {"doc", "ppt", "xls"}:
        preview = parser.convert_office_to_pdf(path, str(output))
        validate_upload(preview, identify_upload("converted.pdf"))
        content = parser.parse_pdf(preview, output_dir=str(output), method="auto", **kwargs)
    elif format_name == "pdf":
        content = parser.parse_pdf(path, output_dir=str(output), method="auto", **kwargs)
    else:
        from PIL import Image

        with Image.open(path) as image:
            frames = getattr(image, "n_frames", 1)
            if frames == 1:
                content = parser.parse_image(path, output_dir=str(output), **kwargs)
            else:
                content = []
                for index in range(frames):
                    image.seek(index)
                    frame = output / f"frame-{index:04d}.png"
                    image.convert("RGB").save(frame)
                    rows = parser.parse_image(frame, output_dir=str(output), **kwargs)
                    for row in rows:
                        row["page_idx"] = index
                    content.extend(rows)
    return content, preview


def parse_document(folder: Path) -> dict:
    """Read source.json, write canonical extraction and completed source metadata."""
    folder = Path(folder).resolve()
    metadata_path = folder / "source.json"
    metadata = json.loads(metadata_path.read_text())
    info = identify_upload(metadata["filename"], metadata.get("media_type"))
    stored_name = metadata["stored_name"]
    if Path(stored_name).name != stored_name or stored_name != "original" + info.extension:
        raise ValueError("invalid_stored_document_name")
    path = folder / stored_name
    metadata.update(validate_upload(path, info))
    output = folder / "parsed"
    output.mkdir(exist_ok=True)
    os.environ["PATH"] = str(Path(sys.executable).parent) + os.pathsep + os.environ.get("PATH", "")
    os.environ.update(
        {
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
            "MINERU_MODEL_SOURCE": "local",
            "OMP_NUM_THREADS": "4",
            "MKL_NUM_THREADS": "4",
            "CUDA_VISIBLE_DEVICES": "",
        }
    )
    preview = None
    if info.format in {"text", "markdown"}:
        content = _parse_text(path, info.format == "markdown")
    elif info.format == "html":
        parser = SafeHTMLBlocks()
        parser.feed(read_document_text(path))
        content = parser.finish()
    elif info.parser == "mineru-office":
        content = _parse_office(path, output, info.format)
    else:
        content, preview = _parse_mineru(path, output, info.format)
    if not content:
        raise ValueError("empty_extraction")
    for row in content:
        if row.get("type") in {"list", "index"}:
            row["block_kind"] = row["type"]
            row["text"] = "\n".join(str(item) for item in row.get("list_items", []))
            row["type"] = "text"
    pages = max(int(row.get("page_idx", 0)) for row in content) + 1
    if pages > MAX_PAGES:
        raise ValueError("document_page_limit: expected 1..1000 locations")
    metadata.update(
        {
            "format": info.format,
            "parser": info.parser,
            "pages": max(pages, metadata.get("pages", 0)),
        }
    )
    if preview is not None:
        metadata["preview_filename"] = str(preview.relative_to(folder))
    (folder / "content.json").write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return metadata


if __name__ == "__main__":
    parse_document(Path(sys.argv[1]))
