import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.unstubAllGlobals());

test("an empty editor shows three starting paths outside the canvas", () => {
  vi.stubGlobal("window", {});

  const markup = renderToStaticMarkup(
    <MantineProvider>
      <App appearance="light" onAppearanceChange={() => undefined} />
    </MantineProvider>,
  );

  expect(markup).toContain('class="welcome-screen"');
  expect(markup).toContain("Choose screenshot");
  expect(markup).toContain("Open project");
  expect(markup).toContain("Start blank");
  expect(markup).toContain('class="canvas"');
  const welcome = markup.match(
    /<section class="welcome-screen"[\s\S]*?<\/section>/,
  )?.[0];
  expect(welcome).toContain("paste an image, or drop one here");
  expect(welcome).toContain("Only the first image is imported.");
  expect(markup).toContain('aria-label="Chat draft"');
  expect(markup).toContain("Try a sample");
  expect(markup).toContain("Place on canvas");
});
