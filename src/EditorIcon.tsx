const paths = {
  select: "M5 3 19 12 12 14 9 21Z",
  crop: "M7 3v14h14M3 7h14v14",
  text: "M4 5h16M12 5v15M8 20h8",
  image: "M3 4h18v16H3ZM3 17l6-6 4 4 3-3 5 5M16 8h.01",
  rectangle: "M3 5h18v14H3Z",
  duplicate: "M8 8h13v13H8ZM16 8V3H3v13h5",
  delete: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  undo: "M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12",
  redo: "m15 4 5 5-5 5M20 9H10a6 6 0 0 0 0 12",
  export: "M12 15V3m-5 5 5-5 5 5M4 14v7h16v-7",
  layers: "m12 3 9 5-9 5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
} as const;

export function EditorIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
