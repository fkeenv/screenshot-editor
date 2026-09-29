import type { TextFontPresentation } from "./presentation";

export function canvasFont(font: TextFontPresentation): string {
  const family = font.family.includes(" ")
    ? `"${font.family.replaceAll('"', "")}"`
    : font.family;
  return `${font.weight} ${font.size}px ${family}, sans-serif`;
}
