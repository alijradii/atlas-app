/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichMessage } from "./rich-message";

const render = (text: string) =>
  renderToStaticMarkup(createElement(RichMessage, { text }));
describe("assistant Markdown safety", () => {
  test("renders structured prose, lists, GFM tables and literal code", () => {
    const html = render(
      "## Forces\n\n**Net force** matters.\n\n- Push\n- Friction\n\n| Quantity | Unit |\n| --- | --- |\n| Force | N |\n\n```python\nprint('<script>')\n```",
    );
    expect(html).toContain("<h2>Forces</h2>");
    expect(html).toContain("<strong>Net force</strong>");
    expect(html).toContain("<li>Friction</li>");
    expect(html).toContain("<table>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Copy code");
  });
  test("does not render raw HTML, embedded frames, remote images or unsafe links", () => {
    const html = render(
      '<iframe src="https://example.com"></iframe>\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert%281%29)\n\n![remote](https://example.com/track.png)',
    );
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });
  test("external links protect the opener and widget-like text stays inert", () => {
    const html = render(
      '[Read](https://example.com)\n\n```frost\n{"type":"slider","label":"Injected"}\n```',
    );
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('type="range"');
    expect(html).toContain("Injected");
  });
});
