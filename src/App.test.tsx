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
  expect(markup).not.toMatch(/drag.and.drop|clipboard|paste/i);
});
