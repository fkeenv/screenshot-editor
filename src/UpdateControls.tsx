import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type UpdateResult =
  | { status: "available"; currentVersion: string; version: string }
  | { status: "current" | "no-release" | "unsupported"; currentVersion: string };

export type UpdateAdapter = {
  check(): Promise<UpdateResult>;
  openRelease(): Promise<void>;
};

declare global {
  interface Window {
    shotMagicUpdates?: UpdateAdapter;
  }
}

export function UpdateControls({ updates }: { updates: UpdateAdapter | undefined }) {
  const [checking, setChecking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<UpdateResult>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!updates) return;
    let active = true;
    void updates.check().then((checked) => {
      if (active && checked.status === "available") setResult(checked);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [updates]);

  if (!updates) return null;

  async function check() {
    if (!updates || checking) return;
    setChecking(true);
    setResult(undefined);
    setMessage(undefined);
    try {
      const checked = await updates.check();
      setResult(checked);
      if (checked.status === "current") setMessage(`ShotMagic ${checked.currentVersion} is up to date.`);
      if (checked.status === "no-release") setMessage("No stable Windows installer is available yet. Try again later.");
      if (checked.status === "unsupported") setMessage("Update checks are available in the installed Windows app.");
    } catch {
      setMessage("Could not check for updates. Check your connection and try again later.");
    } finally {
      setChecking(false);
    }
  }

  async function openRelease() {
    if (!updates || opening) return;
    setOpening(true);
    setMessage(undefined);
    try {
      await updates.openRelease();
    } catch {
      setMessage("Could not open the release page. Please try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <button type="button" className="text-[12px]" onClick={() => void check()} disabled={checking || opening}>
        {checking ? "Checking updates…" : "Check for updates"}
      </button>
      {result?.status === "available" || message ? createPortal(
        <section className="update-notice fixed right-[18px] top-[112px] z-30 grid gap-[10px] w-[360px] max-w-[calc(100vw-36px)] p-[16px] border-[1px] border-solid border-stroke-strong rounded-[8px] bg-panel text-editor shadow-lg" role="status" aria-live="polite" aria-label="Software updates">
          {result?.status === "available" ? (
            <>
              <strong>ShotMagic {result.version} is available</strong>
              <span>You have {result.currentVersion}. Download the new installer from GitHub Releases. Save your project before installing.</span>
              <button type="button" disabled={opening || checking} onClick={() => void openRelease()}>
                {opening ? "Opening release…" : "Download update"}
              </button>
            </>
          ) : null}
          {message ? <span>{message}</span> : null}
          <button type="button" onClick={() => { setResult(undefined); setMessage(undefined); }}>
            Dismiss update notice
          </button>
        </section>, document.body,
      ) : null}
    </>
  );
}
