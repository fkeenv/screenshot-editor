import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { App } from "./App";
import type { AppearancePreference } from "./appearance";
import "./index.css";

const theme = createTheme({
  primaryColor: "gold",
  primaryShade: { light: 7, dark: 3 },
  colors: {
    gold: [
      "#faf4e8",
      "#f4e8d2",
      "#edd9b3",
      "#e4c68d",
      "#d5b273",
      "#bf9656",
      "#a78148",
      "#896538",
      "#6d4f2c",
      "#523b21",
    ],
  },
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: 4,
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
