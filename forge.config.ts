const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.darkwolfie.requestplus',
    name: 'Request+',
    icon: 'build/icon', // Electron Forge will automatically append the correct extension (.ico, .icns, etc.)
    // Code signing configuration (Windows)
    ...(process.env.CERT_PASSWORD && {
      win32metadata: {
        CompanyName: 'DarkWolfieVT',
        ProductName: 'Request+',
        FileDescription: 'Request+ - DJ Song Request Manager'
      },
      osxSign: false, // Disable default signing to use custom
      osxNotarize: false
    })
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'RequestPlus',
        title: 'RequestPlus',
        setupIcon: path.resolve('build/icon.ico'),
        // Code signing for Squirrel installer
        ...(process.env.CERT_PASSWORD && {
          signWithParams: `/f "C:/Users/DarkWolfie/Desktop/backup/Twitch Marathon Timer/build/cert.pfx" /p "${process.env.CERT_PASSWORD}" /tr http://timestamp.digicert.com /td sha256 /fd sha256`,
          certificateFile: 'C:/Users/DarkWolfie/Desktop/backup/Twitch Marathon Timer/build/cert.pfx',
          certificatePassword: process.env.CERT_PASSWORD
        })
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'RequestPlus',
        icon: path.resolve('build/icon.icns'),
        format: 'ULFO',
        overwrite: true,
        debug: false
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: 'build/icon.png',
          maintainer: 'DarkWolfieVT',
          homepage: 'https://requestplus.xyz'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: 'build/icon.png',
          maintainer: 'DarkWolfieVT',
          homepage: 'https://requestplus.xyz'
        }
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.main.config.ts',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.ts',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.ts',
          },
        ],
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  // Publishers configuration if you want to enable auto-updates later
  publishers: [
    // {
    //   name: '@electron-forge/publisher-github',
    //   config: {
    //     repository: {
    //       owner: 'DarkWolfie-YouTube',
    //       name: 'requestplus'
    //     }
    //   }
    // }
  ]
};