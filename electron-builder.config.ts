import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.desktopfinanceapp.app',
  productName: 'Desktop Finance App',
  directories: {
    output: 'release',
    buildResources: 'resources'
  },
  files: ['dist', 'node_modules'],
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.finance'
  },
  win: {
    target: ['installer', 'portable']
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office'
  }
}

export default config
