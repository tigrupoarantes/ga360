/**
 * html-to-pdf.ts
 *
 * Converts template HTML (with placeholders replaced) into pdf-lib draw commands.
 * Supports a limited subset of HTML: h2, h3, p, strong/b, em/i, u, br, text-align.
 * Uses DOMParser from deno-dom for robust HTML parsing.
 */
import { DOMParser, Element, Node } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import type { PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";
import { rgb } from "https://esm.sh/pdf-lib@1.17.1";

// Substitui caracteres acentuados para compatibilidade com Helvetica (WinAnsiEncoding)
function sanitize(text: string): string {
  const map: Record<string, string> = {
    "á": "a", "à": "a", "â": "a", "ã": "a", "ä": "a",
    "é": "e", "è": "e", "ê": "e", "ë": "e",
    "í": "i", "ì": "i", "î": "i", "ï": "i",
    "ó": "o", "ò": "o", "ô": "o", "õ": "o", "ö": "o",
    "ú": "u", "ù": "u", "û": "u", "ü": "u",
    "ç": "c", "ñ": "n",
    "Á": "A", "À": "A", "Â": "A", "Ã": "A", "Ä": "A",
    "É": "E", "È": "E", "Ê": "E", "Ë": "E",
    "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
    "Ó": "O", "Ò": "O", "Ô": "O", "Õ": "O", "Ö": "O",
    "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
    "Ç": "C", "Ñ": "N",
  };
  return text.replace(/[^\x00-\x7F]/g, (char) => map[char] ?? "?");
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

interface DrawContext {
  page: PDFPage;
  fonts: Fonts;
  margin: number;
  textWidth: number;
  pageWidth: number;
  pageHeight: number;
}

type Align = "left" | "center" | "right";

/**
 * Replaces all placeholders in HTML: both <span data-placeholder-key="key">...</span>
 * and raw {{key}} text.
 */
export function replacePlaceholders(
  html: string,
  data: Record<string, string>,
): string {
  // First: replace span-wrapped placeholders
  let result = html.replace(
    /<span[^>]*data-placeholder-key="(\w+)"[^>]*>.*?<\/span>/g,
    (_match, key: string) => data[key] ?? `{{${key}}}`,
  );
  // Second: replace any remaining raw {{key}} text
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => data[key] ?? `{{${key}}}`);
  return result;
}

/**
 * Renders template HTML onto a pdf-lib page.
 * Returns the final Y position after drawing.
 */
export function renderHtmlToPdf(
  templateHtml: string,
  data: Record<string, string>,
  page: PDFPage,
  fonts: Fonts,
): number {
  const { width, height } = page.getSize();
  const margin = 60;
  const textWidth = width - margin * 2;

  const ctx: DrawContext = { page, fonts, margin, textWidth, pageWidth: width, pageHeight: height };

  // Replace placeholders
  const filledHtml = replacePlaceholders(templateHtml, data);

  // Parse HTML
  const doc = new DOMParser().parseFromString(
    `<body>${filledHtml}</body>`,
    "text/html",
  );

  if (!doc?.body) {
    console.error("[html-to-pdf] Failed to parse HTML");
    return height - 80;
  }

  let y = height - 80; // start position

  // Walk top-level children
  for (const child of Array.from(doc.body.childNodes)) {
    if (child.nodeType === 1) {
      // Element node
      y = renderElement(child as Element, ctx, y);
    } else if (child.nodeType === 3) {
      // Text node
      const text = (child.textContent ?? "").trim();
      if (text) {
        y = drawWrappedText(sanitize(text), y, ctx.fonts.regular, 11, ctx, "left");
      }
    }
    if (y < 80) break; // stop if we're near bottom
  }

  return y;
}

function renderElement(el: Element, ctx: DrawContext, y: number): number {
  const tag = el.tagName?.toLowerCase() ?? "";
  const style = el.getAttribute("style") ?? "";
  const align = extractAlign(style);

  switch (tag) {
    case "h1":
    case "h2": {
      y -= 8; // extra spacing before heading
      y = drawBlock(el, ctx, y, ctx.fonts.bold, 13, align);
      y -= 10; // spacing after heading
      break;
    }
    case "h3": {
      y -= 6;
      y = drawBlock(el, ctx, y, ctx.fonts.bold, 12, align);
      y -= 8;
      break;
    }
    case "p": {
      y = drawBlock(el, ctx, y, ctx.fonts.regular, 11, align);
      y -= 8; // paragraph spacing
      break;
    }
    case "ul":
    case "ol": {
      for (const li of Array.from(el.children)) {
        if (li.tagName?.toLowerCase() === "li") {
          const bulletText = `  •  ${getTextContent(li)}`;
          y = drawWrappedText(sanitize(bulletText), y, ctx.fonts.regular, 11, ctx, "left");
          y -= 4;
        }
      }
      y -= 6;
      break;
    }
    case "br": {
      y -= 16; // line break
      break;
    }
    case "hr": {
      const lineW = ctx.textWidth * 0.6;
      const lineX = (ctx.pageWidth - lineW) / 2;
      ctx.page.drawLine({
        start: { x: lineX, y },
        end: { x: lineX + lineW, y },
        thickness: 0.8,
        color: rgb(0, 0, 0),
      });
      y -= 16;
      break;
    }
    default: {
      // Generic: render as paragraph
      const text = getTextContent(el).trim();
      if (text) {
        y = drawWrappedText(sanitize(text), y, ctx.fonts.regular, 11, ctx, align);
        y -= 6;
      }
      break;
    }
  }

  return y;
}

/**
 * Draws a block element, handling inline bold/italic children within it.
 */
function drawBlock(
  el: Element,
  ctx: DrawContext,
  startY: number,
  defaultFont: PDFFont,
  fontSize: number,
  align: Align,
): number {
  // For simplicity with mixed inline formatting, we extract the full text
  // and detect if the whole block uses bold/italic, then draw as one block.
  // For more complex inline mixing, we'd need a run-based renderer.

  const hasBoldChildren = el.querySelector("strong, b") !== null;
  const hasItalicChildren = el.querySelector("em, i") !== null;

  // If the block is mostly one style, use that font
  let font = defaultFont;
  const plainText = getTextContent(el).trim();
  const boldText = getBoldTextContent(el).trim();

  // If >80% of text is bold, render all as bold
  if (boldText.length > plainText.length * 0.8 && hasBoldChildren) {
    font = ctx.fonts.bold;
  } else if (hasItalicChildren && !hasBoldChildren) {
    font = ctx.fonts.italic;
  }

  if (!plainText) return startY;

  return drawWrappedText(sanitize(plainText), startY, font, fontSize, ctx, align);
}

/**
 * Draws text with word-wrap. Returns new Y position.
 */
function drawWrappedText(
  text: string,
  startY: number,
  font: PDFFont,
  fontSize: number,
  ctx: DrawContext,
  align: Align,
): number {
  const lineHeight = fontSize + 5;
  let y = startY;
  const words = text.split(/\s+/);
  let line = "";

  for (const word of words) {
    if (!word) continue;
    const test = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(test, fontSize);

    if (testWidth > ctx.textWidth && line) {
      y = drawLine(line, y, font, fontSize, ctx, align);
      y -= lineHeight;
      line = word;
    } else {
      line = test;
    }
  }

  if (line) {
    y = drawLine(line, y, font, fontSize, ctx, align);
    y -= lineHeight;
  }

  return y;
}

function drawLine(
  text: string,
  y: number,
  font: PDFFont,
  fontSize: number,
  ctx: DrawContext,
  align: Align,
): number {
  if (y < 60) return y; // guard bottom margin

  let x = ctx.margin;
  if (align === "center") {
    const tw = font.widthOfTextAtSize(text, fontSize);
    x = (ctx.pageWidth - tw) / 2;
  } else if (align === "right") {
    const tw = font.widthOfTextAtSize(text, fontSize);
    x = ctx.pageWidth - ctx.margin - tw;
  }

  ctx.page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });

  return y;
}

function extractAlign(style: string): Align {
  const match = style.match(/text-align\s*:\s*(left|center|right)/i);
  return (match?.[1]?.toLowerCase() as Align) ?? "left";
}

function getTextContent(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  let result = "";
  for (const child of Array.from(node.childNodes)) {
    result += getTextContent(child);
  }
  return result;
}

function getBoldTextContent(node: Node): string {
  if (node.nodeType === 3) return "";
  const el = node as Element;
  const tag = el.tagName?.toLowerCase() ?? "";
  if (tag === "strong" || tag === "b") {
    return getTextContent(el);
  }
  let result = "";
  for (const child of Array.from(node.childNodes)) {
    result += getBoldTextContent(child);
  }
  return result;
}
