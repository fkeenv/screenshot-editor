import { Color, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, type MutableRefObject } from "react";
import {
  contentToDocument,
  documentToContent,
  parseColoredText,
  type TextContent,
  type TextLayer,
} from "./editor";
import type { TextLayerPresentation } from "./presentation";
import { PresentedText } from "./PresentedText";

export type TextEditorHandle = {
  applyColor: (color: string) => void;
  focus: () => void;
  preserveOnBlur: () => void;
};

export function InlineTextEditor({
  layer,
  selectText,
  editorHandle,
  presentation,
  onSelectionChange,
  onPreview,
  onColorCommit,
  onCommit,
  onCancel,
}: {
  layer: TextLayer;
  selectText: boolean;
  editorHandle: MutableRefObject<TextEditorHandle | null>;
  presentation: TextLayerPresentation;
  onSelectionChange: (hasSelection: boolean) => void;
  onPreview: (content: TextContent) => void;
  onColorCommit: (content: TextContent) => void;
  onCommit: (content: TextContent) => void;
  onCancel: () => void;
}) {
  const preserveBlur = useRef(false);
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
    onUpdate: ({ editor: current }) => {
      onPreview(documentToContent(current.getJSON()));
    },
    onBlur: ({ editor: current }) => {
      if (preserveBlur.current) return;
      onCommit(documentToContent(current.getJSON()));
    },
  });

  function commit() {
    if (!editor || preserveBlur.current) return;
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
      editor.chain().setColor(color).run();
      onColorCommit(documentToContent(editor.getJSON()));
    },
    focus: () => {
      preserveBlur.current = false;
      editor?.commands.focus();
    },
    preserveOnBlur: () => {
      preserveBlur.current = true;
    },
  };

  useEffect(() => {
    return () => {
      editorHandle.current = null;
      onSelectionChange(false);
    };
  }, [editorHandle, onSelectionChange]);

  return (
    <div className="inline-text-editor-shell">
      <div className="inline-text-preview" aria-hidden="true">
        <PresentedText text={presentation} />
      </div>
      <EditorContent
        editor={editor}
        className="rich-text-surface inline-text-editor"
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
    </div>
  );
}
