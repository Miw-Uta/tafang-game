module.exports = {
  appId: 'com.orangewood.chronicles',
  productName: 'Orangewood',
  executableName: 'Orangewood',
  directories: { app: 'artifacts/desktop-app', output: 'release', buildResources: 'desktop' },
  files: ['desktop/**', 'dist/**', 'package.json', '!node_modules/**/*'],
  asar: true,
  npmRebuild: false,
  electronDist: process.env.ORANGEWOOD_ELECTRON_DIST || undefined,
  artifactName: 'Orangewood-${version}-${os}-${arch}.${ext}',
  win: { target: [{ target: 'zip', arch: ['x64'] }], icon: 'desktop/icon.ico', signAndEditExecutable: process.platform === 'win32' },
  linux: { target: [{ target: 'tar.gz', arch: ['x64'] }], category: 'Game', icon: 'desktop/icon.png', synopsis: 'A forest strategy tower defense campaign' },
  publish: null
};
