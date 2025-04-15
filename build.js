require('dotenv').config();
const builder = require('electron-builder');
const Platform = builder.Platform;
const os = require('os');

// Configuration for the build
const config = {
    appId: 'com.darkwolfie.requestplus',
    productName: 'Request+',
    directories: {
        output: 'dist'
    },
    files: [
        "**/*",
        "!**/*.ts",
        "!*.code-workspace",
        "!LICENSE.md",
        "!package.json",
        "!package-lock.json",
        "!src/",
        "!e2e/",
        "!hooks/",
        "!.angular/",
        "!*.map",
        "!*.md",
        "!.env"
    ],
    win: {
        target: [{
            target: 'nsis',
            arch: ['x64']
        }],
        // Only include certificate settings if CERT_PASSWORD is present
        ...(process.env.CERT_PASSWORD && {
            signtoolOptions: {
                certificateFile: 'C:/Users/DarkWolfie/Desktop/backup/Twitch Marathon Timer/build/cert.pfx',
                certificatePassword: process.env.CERT_PASSWORD,
                publisherName: 'DarkWolfieVT',
                signingHashAlgorithms: ['sha256']
            }
        })
    },
    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: "Request+"
    }
};

async function build() {
    console.log('Starting build process...');
    
    try {
        
        // If in GitHub Actions, always build for Windows
        // If not, build for current platform
        const buildConfig = {
            targets: Platform.WINDOWS.createTarget(),
            config: config,
        };

        await builder.build(buildConfig);
        console.log('Build completed successfully');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
