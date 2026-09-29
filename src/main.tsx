import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { App } from "./App";
import type { AppearancePreference } from "./appearance";
import "./index.css";

const theme = createTheme({
  primaryColor: "periwinkle",
  primaryShade: { light: 7, dark: 3 },
  colors: {
    periwinkle: [
      "#eef0ff", "#e1e5ff", "#c9d0ff", "#adb8ff", "#909fff",
      "#7888ee", "#6475d9", "#5364bf", "#4353a4", "#354287",
    ],
  },
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: "sm",
});

function EditorRoot() {
  const appearance = window.editorAppearance;
  const preference = useSyncExternalStore(
    appearance.subscribe,
    appearance.getPreference,
  );
  const resolved = useSyncExternalStore(
    appearance.subscribe,
    appearance.getResolved,
  );

  return (
    <MantineProvider theme={theme} forceColorScheme={resolved}>
      <App
        appearance={preference}
        onAppearanceChange={(value: AppearancePreference) =>
          appearance.setPreference(value)
        }
      />
    </MantineProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

createRoot(root).render(
  <StrictMode>
    <EditorRoot />
  </StrictMode>,
);
