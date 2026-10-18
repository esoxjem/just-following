#!/usr/bin/env python3
"""Render the review skill's constrained Markdown format as self-contained HTML."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path
from urllib.parse import urlparse


TABLE_DIVIDER = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")
LIST_ITEM = re.compile(r"^\s*[-*+]\s+(.+)$")
ORDERED_ITEM = re.compile(r"^\s*\d+[.)]\s+(.+)$")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def safe_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme and parsed.scheme not in {"http", "https", "mailto"}:
        return "#"
    return html.escape(url.strip(), quote=True)


def inline(text: str) -> str:
    placeholders: list[str] = []

    def preserve_link(match: re.Match[str]) -> str:
        label = format_text(match.group(1))
        target = safe_url(match.group(2))
        placeholders.append(f'<a href="{target}">{label}</a>')
        return f"\x00LINK{len(placeholders) - 1}\x00"

    linked = LINK.sub(preserve_link, text)
    rendered = format_text(linked)
    for index, value in enumerate(placeholders):
        rendered = rendered.replace(f"\x00LINK{index}\x00", value)
    return rendered


def format_text(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", escaped)
    return escaped


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def markdown_to_html(markdown: str) -> tuple[str, str]:
    lines = markdown.splitlines()
    output: list[str] = []
    paragraph: list[str] = []
    list_type: str | None = None
    in_code = False
    code_lines: list[str] = []
    code_language = ""
    issue_open = False
    title = "Modularity Review"
    saw_title = False

    def flush_paragraph() -> None:
        if paragraph:
            content = " ".join(part.strip() for part in paragraph)
            css = ""
            if content.startswith("**Scope**:") or content.startswith("**Date**:"):
                css = ' class="meta"'
            if "This analysis uses the" in content:
                css = ' class="footer"'
            output.append(f"<p{css}>{inline(content)}</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal list_type
        if list_type:
            output.append(f"</{list_type}>")
            list_type = None

    def close_issue() -> None:
        nonlocal issue_open
        if issue_open:
            output.append("</section>")
            issue_open = False

    index = 0
    while index < len(lines):
        line = lines[index]

        if in_code:
            if line.startswith("```"):
                language_class = f' class="language-{html.escape(code_language, quote=True)}"' if code_language else ""
                output.append(f"<pre><code{language_class}>{html.escape(chr(10).join(code_lines))}</code></pre>")
                code_lines.clear()
                code_language = ""
                in_code = False
            else:
                code_lines.append(line)
            index += 1
            continue

        if line.startswith("```"):
            flush_paragraph()
            close_list()
            in_code = True
            code_language = line[3:].strip()
            index += 1
            continue

        heading = HEADING.match(line)
        if heading:
            flush_paragraph()
            close_list()
            level = len(heading.group(1))
            heading_text = heading.group(2)
            if level <= 2:
                close_issue()
            if (level == 2 and heading_text.startswith("Issue:")) or (
                level == 3 and re.match(r"\[P[123]\]", heading_text)
            ):
                close_issue()
                output.append('<section class="issue">')
                issue_open = True
            if level == 1 and not saw_title:
                title = re.sub(r"[*_`]", "", heading_text)
                saw_title = True
            output.append(f"<h{level}>{inline(heading_text)}</h{level}>")
            index += 1
            continue

        if index + 1 < len(lines) and "|" in line and TABLE_DIVIDER.match(lines[index + 1]):
            flush_paragraph()
            close_list()
            headers = split_row(line)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                rows.append(split_row(lines[index]))
                index += 1
            output.append("<div class=\"table-wrap\"><table><thead><tr>")
            output.extend(f"<th>{inline(cell)}</th>" for cell in headers)
            output.append("</tr></thead><tbody>")
            for row in rows:
                output.append("<tr>")
                padded = row + [""] * (len(headers) - len(row))
                output.extend(f"<td>{inline(cell)}</td>" for cell in padded[: len(headers)])
                output.append("</tr>")
            output.append("</tbody></table></div>")
            continue

        unordered = LIST_ITEM.match(line)
        ordered = ORDERED_ITEM.match(line)
        if unordered or ordered:
            flush_paragraph()
            wanted = "ul" if unordered else "ol"
            if list_type != wanted:
                close_list()
                output.append(f"<{wanted}>")
                list_type = wanted
            item = unordered.group(1) if unordered else ordered.group(1)
            output.append(f"<li>{inline(item)}</li>")
            index += 1
            continue

        if re.match(r"^\s*(-{3,}|_{3,}|\*{3,})\s*$", line):
            flush_paragraph()
            close_list()
            output.append("<hr>")
            index += 1
            continue

        if line.startswith("> "):
            flush_paragraph()
            close_list()
            output.append(f"<blockquote>{inline(line[2:])}</blockquote>")
            index += 1
            continue

        if not line.strip():
            flush_paragraph()
            close_list()
        else:
            paragraph.append(line)
        index += 1

    if in_code:
        output.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
    flush_paragraph()
    close_list()
    close_issue()
    return title, "\n".join(output)


def render(markdown_path: Path, output_path: Path, template_path: Path) -> None:
    source = markdown_path.read_text(encoding="utf-8")
    template = template_path.read_text(encoding="utf-8")
    if "{{TITLE}}" not in template or "{{CONTENT}}" not in template:
        raise ValueError("Template must contain {{TITLE}} and {{CONTENT}} placeholders")
    title, content = markdown_to_html(source)
    document = template.replace("{{TITLE}}", html.escape(title)).replace("{{CONTENT}}", content)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(document, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("markdown", type=Path, help="Input Markdown review")
    parser.add_argument("output", nargs="?", type=Path, help="Output HTML path")
    parser.add_argument("--template", type=Path, help="HTML template with TITLE and CONTENT placeholders")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    default_template = script_dir.parent / "assets" / "review-template.html"
    output = args.output or args.markdown.with_suffix(".html")
    render(args.markdown, output, args.template or default_template)
    print(output)


if __name__ == "__main__":
    main()
