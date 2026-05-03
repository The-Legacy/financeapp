const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

exports.default = async function beforePack(context) {
  const appDir =
    context.appDir ||
    context.packager?.appDir ||
    context.packager?.projectDir ||
    context.projectDir ||
    process.cwd()

  const requiredOutputs = [
    'dist/main/index.js',
    'dist/preload/index.js',
    'dist/renderer/index.html'
  ].map((relativePath) => join(appDir, relativePath))

  if (requiredOutputs.every(existsSync)) {
    return
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(npmCommand, ['run', 'build'], {
    cwd: appDir,
    stdio: 'inherit'
  })
}