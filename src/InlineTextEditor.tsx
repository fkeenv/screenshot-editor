import { Color, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, type MutableRefObject, type ReactNode } from "react";
import {
  contentToDocument,
  documentToContent,
  parseColoredText,
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        horizontalRule: false,
      }),
      TextStyle,
      Color,
    ],
    content: contentToDocument({
      text: layer.text,
      colorRuns: layer.colorRuns,
    }),
    editorProps: {
      attributes: { "aria-label": `Edit ${layer.name}` },
      handlePaste: (_view, event) => {
        const pasted = event.clipboardData?.getData("text/plain");
        if (!pasted || !editor) return false;
        const parsed = contentToDocument(parseColoredText(pasted));
        editor.chain().focus().insertContent(parsed.content ?? []).run();
        return true;
      },
    },
    onSelectionUpdate: ({ editor: current }) => {
      onSelectionChange(!current.state.selection.empty);
    },
    onBlur: ({ editor: current }) => {
      onCommit(documentToContent(current.getJSON()));
    },
  });

  function commit() {
    if (!editor) return;
    onCommit(documentToContent(editor.getJSON()));
  }

  function reportSelection() {
    if (!editor) return;
    onSelectionChange(!editor.state.selection.empty);
  }

  useEffect(() => {
    if (!editor) return;
    editor.commands.focus();
    if (selectText) editor.commands.selectAll();
    reportSelection();
  }, [editor, selectText]);

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = documentToContent(editor.getJSON());
    if (current.text === layer.text) return;
    editor.commands.setContent(
      contentToDocument({ text: layer.text, colorRuns: layer.colorRuns }),
      { emitUpdate: false },
    );
  }, [editor, layer.text, layer.colorRuns]);

  editorHandle.current = {
    applyColor: (color) => {
      if (!editor || editor.state.selection.empty) return;
      const previous = documentToContent(editor.getJSON());
      editor.chain().focus().setColor(color).run();
      const next = documentToContent(editor.getJSON());
      onColorCommit(previous, next);
    },
    focus: () => editor?.commands.focus(),
    preserveOnBlur: () => undefined,
  };

  useEffect(() => {
    return () => {
      editorHandle.current = null;
      onSelectionChange(false);
    };
  }, [editorHandle, onSelectionChange]);

  return (
    <EditorContent
      editor={editor}
      className="rich-text-surface"
      onBlur={commit}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onMouseUp={reportSelection}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
      }}
    />
  );
}
