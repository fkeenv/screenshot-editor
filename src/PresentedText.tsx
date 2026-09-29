import { textLayerStyles } from "./dom-presentation";
import type { TextLayerPresentation } from "./presentation";

export function PresentedText({ text }: { text: TextLayerPresentation }) {
  const styles = textLayerStyles(text);
  return (
    <div className="presented-text">
      {text.lines.map((line, lineIndex) => (
        <div
          className="presented-text-line"
          style={styles.line}
          key={lineIndex}
        >
          {line.segments.map((segment) => (
            <span style={{ color: segment.color }} key={segment.offset}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
