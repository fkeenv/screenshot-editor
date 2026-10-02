module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "screenshot-editor",
    ignore: [
      /^\/\.git($|\/)/,
      /^\/\.github($|\/)/,
      /^\/\.scratch($|\/)/,
      /^\/docs($|\/)/,
      /^\/desktop\/.*\.test\.ts$/,
      /^\/node_modules\/(?!electron-squirrel-startup(?:\/|$))/,
      /^\/src($|\/)/,
      /^\/out($|\/)/,
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "screenshot_editor",
      },
    },
  ],
};
