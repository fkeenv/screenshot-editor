export type AppearancePreference = "light" | "dark" | "system";
export type ResolvedAppearance = Exclude<AppearancePreference, "system">;

declare global {
  interface Window {
    editorAppearance: {
      getPreference: () => AppearancePreference;
      getResolved: () => ResolvedAppearance;
      setPreference: (value: AppearancePreference) => void;
      subscribe: (listener: () => void) => () => void;
    };
  }
}
