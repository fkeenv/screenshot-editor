# ShotMagic

ShotMagic is an editor for your **GTA roleplay screenshots**. Import a scene, add your chat log, adjust the layout, and turn it into a finished image to share with your roleplay community.

Whether you're documenting your character's story, sharing a memorable interaction, or preparing a forum post, ShotMagic keeps screenshot and chat editing in one workspace. Crop out distractions, format dialogue and roleplay actions, and stitch several scenes into a single image.

Use ShotMagic in your browser or as a Windows desktop app. Start with a screenshot or a blank canvas, arrange images, text, and rectangles as layers, then save an editable project or export the finished picture. Image processing happens on your device; your screenshots are not uploaded to a server.

## Download for Windows

A Windows `.exe` installer is available on the [Releases page](https://github.com/fkeenv/shotmagic/releases).

1. Open the latest release and expand **Assets**.
2. Download the `.exe` installer.
3. Run the installer, then open ShotMagic to start editing your GTA roleplay screenshots.

You do not need Node.js or npm when using the installer.

### Update ShotMagic

The installed Windows app checks for updates when it starts. If a newer stable release has a Windows installer, a notice shows the available version. You can also choose **Check for updates** in the top bar.

Choose **Download update** to open that release in your browser. Save your project, close ShotMagic, and run the new `.exe` installer. Updates are not downloaded or installed automatically, and dismissing the notice lets you keep editing.

Update checks contact GitHub for public release information only; screenshots, chat logs, and projects are not sent. Offline startup checks stay quiet. A manual check reports connection errors and can be retried. Browser and desktop development builds do not check for updates.

Older versions without the update checker need one manual update from the Releases page before they can show these notices.

## Features

- **Images:** import JPG, PNG, WebP, GIF, or BMP files. Paste or drag and drop an image, move it, resize it proportionally, or edit its position numerically. Only the first image is imported at a time.
- **Cropping:** drag corner and edge handles to crop an image. Pan, zoom, or use Fit image to reach the edges of long screenshots. Apply or cancel without losing the original source image.
- **GTA roleplay chat:** type or paste chat logs and place them over your screenshots. Recognized dialogue and action lines receive matching roleplay colors automatically. Choose named presets such as `/me`, `/do`, speech, whisper, and radio, with visible color swatches.
- **Text editing:** edit text directly on the canvas and adjust font, size, bold, color, outline, shadow, line spacing, and text-box width.
- **Rectangles:** add simple shapes with editable fill, size, position, and opacity.
- **Layers:** select, rename, reorder, hide, duplicate, or delete layers. Undo and redo edits.
- **Alignment:** show an adjustable grid and enable grid snapping. Snap layers to canvas center, edges, corners, or padded corners, with labeled guides while dragging. Padding defaults to 16px; hold Shift to bypass snapping.
- **Canvas and appearance:** choose preset or custom dimensions, a transparent or solid background, and light, dark, or system appearance. Hide the inspector or Layers panel for more room.
- **Scenes and stories:** save editable projects, export PNG/JPG/WebP images to share, or combine two or more saved scenes into a vertical stitch.

Grid lines, alignment guides, selection borders, and text highlights are editing aids only. They do not appear in exports.

## Edit your first GTA roleplay screenshot

1. Import your GTA roleplay screenshot, paste or drop it into ShotMagic, or select **Start blank** to create a composition from scratch.
2. Paste your scene's chat log into the **Chat** tab, then choose **Place on canvas** and click where the text should go. Adjust the chat's formatting in Properties and use the rectangle tool when you need a simple shape.
3. Select a layer to edit it in **Properties**. Use **Layers** to change visibility and order.
4. Enable **Grid**, **Snap**, or **Guides** when you need help with alignment. Adjust grid spacing and snap padding in Properties.
5. Choose **Save** to keep an editable `.screenshot-project.json` file. Choose **Export** for a finished image, or use **Stitch** to combine several saved scenes into one story.

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

To make a new version discoverable by the Windows app, update the version in `package.json` and `package-lock.json`, build the Windows installer, and publish a stable GitHub release tagged with that version (for example, `v2026.10.1`). Attach the finished `.exe` installer before publishing and mark the release as the latest release. Draft releases, prereleases, and releases without an uploaded installer are not announced. Uploading a CI artifact alone does not publish a release.

See [release notes](CHANGELOG.md) for the current feature overview. Existing projects remain supported, but projects containing rectangle layers may not open in older builds.
