import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const bootstrap = readFileSync(
  new URL("../public/appearance-bootstrap.js", import.meta.url),
  "utf8",
);

function startAppearance(stored: string | null, systemDark: boolean) {
  const values = new Map<string, string>();
  if (stored !== null) values.set("screenshot-editor-appearance", stored);
  const root = { dataset: {} as Record<string, string> };
  const events = new Map<string, (event: { key?: string; newValue?: string | null }) => void>();
  const media = {
    matches: systemDark,
    addEventListener: (_name: string, callback: () => void) => {
      events.set("media", callback);
    },
  };
  const window = {
    matchMedia: () => media,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    addEventListener: (_name: string, callback: (event: { key?: string; newValue?: string | null }) => void) => {
      events.set("storage", callback);
    },
    editorAppearance: undefined as {
      getPreference: () => string;
      getResolved: () => string;
      setPreference: (value: string) => void;
      subscribe: (listener: () => void) => () => void;
    } | undefined,
  };

  runInNewContext(bootstrap, { document: { documentElement: root }, window, Set });
  const appearance = window.editorAppearance;
  if (!appearance) throw new Error("Appearance bootstrap did not initialize");
  return { appearance, root, media, values, events };
}

describe("editor appearance", () => {
  it("applies the system theme before app startup and follows device changes", () => {
    const state = startAppearance(null, false);
    expect(state.root.dataset).toMatchObject({
      appearance: "light",
      appearancePreference: "system",
      mantineColorScheme: "light",
    });
    state.media.matches = true;
    state.events.get("media")?.({});
    expect(state.root.dataset.appearance).toBe("dark");
    expect(state.root.dataset.mantineColorScheme).toBe("dark");
  });

  it("persists an explicit override and ignores later device changes", () => {
    const state = startAppearance(null, true);
    state.appearance.setPreference("light");
    expect(state.values.get("screenshot-editor-appearance")).toBe("light");
    expect(state.root.dataset.appearance).toBe("light");
    state.media.matches = false;
    state.events.get("media")?.({});
    expect(state.root.dataset.appearance).toBe("light");
    expect(startAppearance("light", true).root.dataset.appearance).toBe("light");
  });

  it("treats unknown saved values as System and syncs changes across tabs", () => {
    const state = startAppearance("unknown", true);
    expect(state.appearance.getPreference()).toBe("system");
    state.events.get("storage")?.({ key: "screenshot-editor-appearance", newValue: "light" });
    expect(state.root.dataset.appearance).toBe("light");
    state.events.get("storage")?.({ key: "screenshot-editor-appearance", newValue: null });
    expect(state.root.dataset.appearancePreference).toBe("system");
    expect(state.root.dataset.appearance).toBe("dark");
  });
});
