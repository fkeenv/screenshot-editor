# Release notes

## 2026.10.0 — October 2, 2026

### What is Screenshot Editor?

Screenshot Editor is a local, layer-based editor for composing screenshots, adding roleplay chat, and combining scenes into one image. It runs in a browser or as a Windows desktop app. Images are processed on your device, not uploaded to a server.

Start with a screenshot or a blank canvas, add text and shapes, and save an editable project or export the finished image.

### Available features

#### Images and canvas

- Import JPG, PNG, WebP, GIF, and BMP images using the file picker. You can also paste or drag and drop an image; only the first image is imported at a time.
- Move images, resize them proportionally from their corners, edit their position, or use scale presets and Fit.
- Crop images with draggable corner and edge handles. Pan, zoom, and Fit image while cropping to reach the edges of long screenshots. Apply or cancel the crop.
- Choose a canvas-size preset or enter custom dimensions. Use a transparent background or a solid color.

#### Text and shapes

- Type or paste a chat log and place it on the canvas. Common roleplay chat lines receive matching colors automatically.
- Edit text directly on the canvas. Adjust font, size, bold, line spacing, text-box width, outline, and shadow.
- Apply named color presets with swatches or choose a custom color for selected text.
- Add rectangles and edit their fill, size, position, and opacity.

#### Layers and alignment

- Select, rename, reorder, hide, duplicate, and delete layers. Adjust opacity and use undo/redo.
- Show a grid with adjustable spacing. Snap layer movement and text placement to the grid.
- Snap layer movement to canvas center, edges, corners, or an inset padding of your choice. Padding defaults to 16px.
- See labeled alignment lines while snapping. Hold Shift while dragging to bypass snapping.

#### Projects and exports

- Save editable projects and reopen them later with their layers and styling intact.
- Export the visible canvas as PNG, JPG, or WebP, with quality controls for JPG and WebP and a lossless option for WebP.
- Combine two or more saved projects into a vertical stitch in your chosen order.
- PNG and WebP support transparent backgrounds. JPG uses the chosen solid canvas background or an opaque fallback for transparent projects.

#### Editor workspace

- A compact tool rail, Properties inspector, and Layers panel keep editing controls together. Hide either panel when you need more room.
- Pan and zoom the workspace, or fit the canvas to the available space.
- Choose light, dark, or system appearance.
- Crop and image-resize borders use contrasting dashed lines. Selected text uses a blue highlight with white lettering.
- Clicking the empty workspace outside the canvas deselects layers and finishes text editing without losing changes.

### Notes

Grid lines, alignment guides, selection borders, and text highlights are editing aids and do not appear in exports. Crop navigation does not add undo steps or clear redo history. Existing projects remain supported; projects containing rectangle layers may not open in older builds.

### Versioning

Releases use CalVer in the form `YYYY.M.PATCH`. `2026.10.0` is the first versioned build for October 2026. Further releases that month increment the final number, such as `2026.10.1`; the first release in November would be `2026.11.0`. Months have no leading zero so versions remain valid for npm and desktop packaging.
