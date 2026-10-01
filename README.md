# ShotMagic

A local editor for composing screenshots, adding roleplay chat, and combining scenes into one image. Use it in your browser or as a Windows desktop app.

Start with a screenshot or a blank canvas, arrange images, text, and rectangles as layers, then save an editable project or export the finished picture. Image processing happens on your device; your screenshots are not uploaded to a server.

## Features

- **Images:** import JPG, PNG, WebP, GIF, or BMP files. Paste or drag and drop an image, move it, resize it proportionally, or edit its position numerically. Only the first image is imported at a time.
- **Cropping:** drag corner and edge handles to crop an image. Pan, zoom, or use Fit image to reach the edges of long screenshots. Apply or cancel without losing the original source image.
- **Roleplay chat:** type or paste chat logs and place them on the canvas. Common chat lines receive matching colors automatically. Named color presets include visible swatches.
- **Text editing:** edit text directly on the canvas and adjust font, size, bold, color, outline, shadow, line spacing, and text-box width.
- **Rectangles:** add simple shapes with editable fill, size, position, and opacity.
- **Layers:** select, rename, reorder, hide, duplicate, or delete layers. Undo and redo edits.
- **Alignment:** show an adjustable grid and enable grid snapping. Snap layers to canvas center, edges, corners, or padded corners, with labeled guides while dragging. Padding defaults to 16px; hold Shift to bypass snapping.
- **Canvas and appearance:** choose preset or custom dimensions, a transparent or solid background, and light, dark, or system appearance. Hide the inspector or Layers panel for more room.
- **Projects and exports:** save editable projects, export PNG/JPG/WebP images, or combine two or more saved projects into a vertical stitch.

Grid lines, alignment guides, selection borders, and text highlights are editing aids only. They do not appear in exports.

## Your first project

1. Choose a screenshot, paste or drop an image, or select **Start blank**.
2. Add chat through the **Chat** tab, then choose **Place on canvas** and click where the text should go. Use the rectangle tool to add a shape.
3. Select a layer to edit it in **Properties**. Use **Layers** to change visibility and order.
4. Enable **Grid**, **Snap**, or **Guides** when you need help with alignment. Adjust grid spacing and snap padding in Properties.
5. Choose **Save** to keep an editable `.screenshot-project.json` file. Choose **Export** for a finished image.

Double-click text to edit it. Clicking the empty workspace outside the canvas finishes editing and deselects layers. Save your project before closing; exporting an image does not replace saving the editable project.

PNG and WebP support transparency. JPG uses the chosen solid canvas background or an opaque fallback when the project is transparent. JPG and WebP have quality controls, and WebP also offers a lossless option.

## Run from source

Use Node.js 22 and npm, matching the project's CI environment.

### Browser

```bash
npm ci
npm run dev
```

Open the local address printed by the development server. To build the web app, run `npm run build`; the output is in `dist/`.

### Desktop development

```bash
npm run desktop:dev
```

This starts the development server and opens the Electron app. Run `npm ci` first if you have not installed dependencies.

### Windows installer

On Windows, after installing dependencies:

```bash
npm run desktop:make
```

The installer files are written to `out/make/`. Windows CI runs the same command and uploads a `screenshot-editor-windows` artifact. Building the installer from a non-Windows machine requires Mono and Wine.

## Development checks

```bash
npm run typecheck
npm test
npm run build
```

The app uses React, TypeScript, Tailwind CSS, Mantine, and Tiptap, with Electron for the desktop shell.

## Releases and compatibility

Versions use CalVer: `YYYY.M.PATCH`, such as `2026.10.0`. The final number increases for additional releases in the same month; months do not have leading zeros.

See [release notes](CHANGELOG.md) for the current feature overview. Existing projects remain supported, but projects containing rectangle layers may not open in older builds.
