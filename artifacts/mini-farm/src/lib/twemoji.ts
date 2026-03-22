const BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

export function emojiUrl(emoji: string): string {
  const codes = [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16).toLowerCase())
    .join("-");
  return `${BASE}/${codes}.svg`;
}
