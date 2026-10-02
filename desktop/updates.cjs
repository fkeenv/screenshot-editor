const RELEASE_API = "https://api.github.com/repos/fkeenv/shotmagic/releases/latest";
const RELEASE_BASE = "https://github.com/fkeenv/shotmagic/releases/tag/";

function versionParts(version) {
  if (typeof version !== "string" || !/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("Invalid release version.");
  }
  return version.replace(/^v/, "").split(".").map(BigInt);
}

function newerVersion(candidate, installed) {
  const next = versionParts(candidate);
  const current = versionParts(installed);
  for (let index = 0; index < 3; index++) {
    if (next[index] !== current[index]) return next[index] > current[index];
  }
  return false;
}

function createUpdateChecker({ currentVersion, enabled, fetchRelease, openExternal }) {
  let pending;
  let releaseUrl;

  async function checkRelease() {
    releaseUrl = undefined;
    if (!enabled) return { status: "unsupported", currentVersion };
    const response = await fetchRelease(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": `ShotMagic/${currentVersion}` },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      credentials: "omit",
    });
    if (response.status === 404) return { status: "no-release", currentVersion };
    if (!response.ok) throw new Error("Could not check for updates. Please try again later.");
    const release = await response.json();
    if (!release || release.draft !== false || release.prerelease !== false ||
      !Array.isArray(release.assets) || !release.assets.some(asset =>
        asset && typeof asset.name === "string" && /\.exe$/i.test(asset.name) &&
        asset.state === "uploaded" && asset.size > 0)) {
      return { status: "no-release", currentVersion };
    }
    if (!newerVersion(release.tag_name, currentVersion)) return { status: "current", currentVersion };
    releaseUrl = RELEASE_BASE + encodeURIComponent(release.tag_name);
    return { status: "available", currentVersion, version: release.tag_name.replace(/^v/, "") };
  }

  return {
    check() {
      if (!pending) pending = checkRelease().finally(() => { pending = undefined; });
      return pending;
    },
    async openRelease() {
      if (!releaseUrl) throw new Error("Check for an available update first.");
      await openExternal(releaseUrl);
    },
  };
}

function registerUpdateHandlers(ipcMain, checker, isTrustedSender) {
  for (const [channel, action] of [
    ["updates:check", () => checker.check()],
    ["updates:open-release", () => checker.openRelease()],
  ]) {
    ipcMain.handle(channel, (event) => {
      if (!isTrustedSender(event)) throw new Error("Untrusted update request.");
      return action();
    });
  }
}

module.exports = { createUpdateChecker, registerUpdateHandlers };
