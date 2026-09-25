import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  colorTextRange,
  replaceTextRange,
  type TextColorRun,
  type TextContent,
  type TextLayer,
} from "./editor";

export type TextEditorHandle = {
  applyColor: (color: string) => void;
  focus: () => void;
  preserveOnBlur: () => void;
};

export function ColoredText({
  text,
  colorRuns,
}: {
  text: string;
  colorRuns: TextColorRun[];
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const run of colorRuns) {
    if (cursor < run.start) parts.push(text.slice(cursor, run.start));
    parts.push(
      <span style={{ color: run.color }} key={`${run.start}-${run.end}`}>
        {text.slice(run.start, run.end)}
      </span>,
    );
    cursor = run.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function InlineTextEditor({
  layer,
  selectText,
  editorHandle,
  onSelectionChange,
  onColorCommit,
  onHistory,
  onCommit,
  onCancel,
}: {
  layer: TextLayer;
  selectText: boolean;
  editorHandle: MutableRefObject<TextEditorHandle | null>;
  onSelectionChange: (hasSelection: boolean) => void;
  onColorCommit: (previous: TextContent, next: TextContent) => void;
  onHistory: (redo: boolean) => void;
  onCommit: (content: TextContent) => void;
  onCancel: () => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const cancelEdit = useRef(false);
  const preserveOnBlur = useRef(false);
  const selection = useRef({ start: 0, end: 0 });
  const [content, setContent] = useState<TextContent>({
    text: layer.text,
    colorRuns: layer.colorRuns,
  });
  const contentRef = useRef(content);

  function resize(element: HTMLTextAreaElement) {
    element.style.height = "0";
    element.style.height = `${element.scrollHeight}px`;
  }

  function updateContent(next: TextContent) {
    contentRef.current = next;
    setContent(next);
  }

  function rememberSelection(element: HTMLTextAreaElement) {
    selection.current = {
      start: element.selectionStart,
      end: element.selectionEnd,
    };
    onSelectionChange(element.selectionStart !== element.selectionEnd);
  }

  function restoreSelection() {
    requestAnimationFrame(() => {
      const element = textarea.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(selection.current.start, selection.current.end);
    });
  }

  function applyColor(color: string) {
    const { start, end } = selection.current;
    if (start === end) return;
    const previous = contentRef.current;
    const next = colorTextRange(previous, start, end, color);
    updateContent(next);
    onColorCommit(previous, next);
    restoreSelection();
  }

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    resize(element);
    element.focus();
    if (selectText) {
      element.select();
      rememberSelection(element);
    }
  }, [selectText]);

  useEffect(() => {
    const element = textarea.current;
    if (element) resize(element);
  }, [content.text]);

  useEffect(() => {
    if (
      layer.text !== contentRef.current.text ||
      layer.colorRuns !== contentRef.current.colorRuns
    ) {
      updateContent({ text: layer.text, colorRuns: layer.colorRuns });
    }
  }, [layer.text, layer.colorRuns]);

  editorHandle.current = {
    applyColor,
    focus: restoreSelection,
    preserveOnBlur: () => {
      preserveOnBlur.current = true;
    },
  };

  useEffect(() => {
    return () => {
      editorHandle.current = null;
      onSelectionChange(false);
    };
  }, [editorHandle, onSelectionChange]);

  function finishEditing(event: FocusEvent<HTMLTextAreaElement>) {
    if (preserveOnBlur.current) {
      preserveOnBlur.current = false;
      return;
    }
    if (
      event.relatedTarget instanceof HTMLElement &&
      event.relatedTarget.closest("[data-text-color-control]")
    ) {
      return;
    }
    if (cancelEdit.current) {
      onCancel();
      return;
    }
    onCommit(contentRef.current);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    event.stopPropagation();
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "z" &&
      contentRef.current.text === layer.text
    ) {
      event.preventDefault();
      onHistory(event.shiftKey);
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancelEdit.current = true;
    event.currentTarget.blur();
  }

  function changeText(nextText: string) {
    const previous = contentRef.current.text;
    let start = 0;
    while (start < previous.length && previous[start] === nextText[start]) {
      start += 1;
    }
    let previousEnd = previous.length;
    let nextEnd = nextText.length;
    while (
      previousEnd > start &&
      nextEnd > start &&
      previous[previousEnd - 1] === nextText[nextEnd - 1]
    ) {
      previousEnd -= 1;
      nextEnd -= 1;
    }
    updateContent(
      replaceTextRange(
        contentRef.current,
        start,
        previousEnd,
        nextText.slice(start, nextEnd),
      ),
    );
  }

  function pasteText(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const previousLength = contentRef.current.text.length;
    const next = replaceTextRange(
      contentRef.current,
      start,
      end,
      event.clipboardData.getData("text/plain"),
    );
    const caret = start + next.text.length - (previousLength - (end - start));
    selection.current = { start: caret, end: caret };
    onSelectionChange(false);
    updateContent(next);
    restoreSelection();
  }

  return (
    <div className="inline-text-editor-shell">
      <div className="inline-text-preview" aria-hidden="true">
        <ColoredText text={content.text} colorRuns={content.colorRuns} />
      </div>
      <textarea
        ref={textarea}
        className="inline-text-editor"
        aria-label={`Edit ${layer.name}`}
        value={content.text}
        spellCheck
        onChange={(event) => changeText(event.target.value)}
        onSelect={(event) => rememberSelection(event.currentTarget)}
        onPaste={pasteText}
        onBlur={finishEditing}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      />
    </div>
  );
}
