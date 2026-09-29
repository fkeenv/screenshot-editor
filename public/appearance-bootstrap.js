(function () {
  const key = "screenshot-editor-appearance";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listeners = new Set();

  function valid(value) {
    return value === "light" || value === "dark" || value === "system";
  }

  let preference = "system";
  try {
    const stored = window.localStorage.getItem(key);
    if (valid(stored)) preference = stored;
  } catch {}

  function resolved() {
    return preference === "system"
      ? media.matches ? "dark" : "light"
      : preference;
  }

  function apply() {
    const scheme = resolved();
    root.dataset.appearance = scheme;
    root.dataset.appearancePreference = preference;
    root.dataset.mantineColorScheme = scheme;
    listeners.forEach((listener) => listener());
  }

  window.editorAppearance = {
    getPreference: () => preference,
    getResolved: resolved,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setPreference(next) {
      if (!valid(next) || next === preference) return;
      preference = next;
      try {
        window.localStorage.setItem(key, next);
      } catch {}
      apply();
    },
  };

  media.addEventListener("change", () => {
    if (preference === "system") apply();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== key) return;
    preference = valid(event.newValue) ? event.newValue : "system";
    apply();
  });
  apply();
})();
