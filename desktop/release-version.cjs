function verifyReleaseVersion(packageJson, packageLock, ref = "") {
  const version = packageJson.version;
  if (packageLock.version !== version || packageLock.packages?.[""]?.version !== version) {
    throw new Error(`Package and lockfile versions must all match ${version}.`);
  }
  if (ref.startsWith("refs/tags/")) {
    const tagVersion = ref.slice("refs/tags/".length).replace(/^v/, "");
    if (tagVersion !== version) {
      throw new Error(`Release tag ${tagVersion} does not match package version ${version}. Build the version-bump commit instead.`);
    }
  }
  return version;
}

if (require.main === module) {
  const version = verifyReleaseVersion(
    require("../package.json"),
    require("../package-lock.json"),
    process.env.GITHUB_REF,
  );
  console.log(`Building ShotMagic ${version}`);
}

module.exports = { verifyReleaseVersion };
