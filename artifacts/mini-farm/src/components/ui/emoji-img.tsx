import { emojiUrl } from "@/lib/twemoji";

interface EmojiImgProps {
  emoji: string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function EmojiImg({ emoji, size = 28, className = "", style }: EmojiImgProps) {
  return (
    <img
      src={emojiUrl(emoji)}
      alt={emoji}
      draggable={false}
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        verticalAlign: "middle",
        userSelect: "none",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

interface EmojiSvgImageProps {
  emoji: string;
  x: number;
  y: number;
  size: number;
}

export function EmojiSvgImage({ emoji, x, y, size }: EmojiSvgImageProps) {
  return (
    <image
      href={emojiUrl(emoji)}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      style={{ pointerEvents: "none" }}
    />
  );
}
