import { createRequire } from "node:module";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { verifyReleaseVersion } = require("./release-version.cjs");
const packageJson = { version: "2026.10.1" };
const lockfile = { version: "2026.10.1", packages: { "": { version: "2026.10.1" } } };

test("repository package metadata agrees on its release version", () => {
  expect(verifyReleaseVersion(require("../package.json"), require("../package-lock.json")))
    .toBe(require("../package.json").version);
});

test.each(["", "refs/heads/main", "refs/tags/v2026.10.1", "refs/tags/2026.10.1"])("accepts matching versions for %s", (ref) => {
  expect(verifyReleaseVersion(packageJson, lockfile, ref)).toBe("2026.10.1");
});

test("a new tag on old source fails before building the installer", () => {
  const previous = { version: "2026.10.0" };
  const previousLock = { version: "2026.10.0", packages: { "": previous } };
  expect(() => verifyReleaseVersion(previous, previousLock, "refs/tags/v2026.10.1"))
    .toThrow("Release tag 2026.10.1 does not match package version 2026.10.0");
});

test.each([
  { ...lockfile, version: "2026.10.0" },
  { ...lockfile, packages: { "": { version: "2026.10.0" } } },
  { version: "2026.10.1" },
])("rejects inconsistent lockfile %j", (lock) => {
  expect(() => verifyReleaseVersion(packageJson, lock)).toThrow("must all match 2026.10.1");
});
