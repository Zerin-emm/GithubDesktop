import * as Path from 'path'

import { mkdir, writeFile } from 'fs/promises'
import { getPathSegments, setPathSegments } from '../lib/process/win32'

/**
 * Install the `github` CLI trampoline: write a small script into a stable
 * `bin` folder next to the app and add that folder to the user's `PATH`.
 */
export async function installWindowsCLI(): Promise<void> {
  const binPath = getBinPath()
  await mkdir(binPath, { recursive: true })
  await writeBatchScriptCLITrampoline(binPath)
  await writeShellScriptCLITrampoline(binPath)
  try {
    const paths = getPathSegments()
    if (paths.indexOf(binPath) < 0) {
      await setPathSegments([...paths, binPath])
    }
  } catch (e) {
    log.error('Failed inserting bin path into PATH environment variable', e)
  }
}

export async function uninstallWindowsCLI() {
  try {
    const paths = getPathSegments()
    const binPath = getBinPath()
    const pathsWithoutBinPath = paths.filter(p => p !== binPath)
    return setPathSegments(pathsWithoutBinPath)
  } catch (e) {
    log.error('Failed removing bin path from PATH environment variable', e)
  }
}

/**
 * Get the path for the `bin` directory which exists outside of the
 * app's own directory, so that it survives the app folder being moved
 * or replaced.
 */
function getBinPath(): string {
  return Path.resolve(process.execPath, '../../bin')
}

function resolveVersionedPath(binPath: string, relativePath: string): string {
  const appFolder = Path.resolve(process.execPath, '..')
  return Path.relative(binPath, Path.join(appFolder, relativePath))
}

/**
 * Here's the problem: our app's path contains its version number. So each time
 * we update, the path to our app changes. So it's Real Hard to add our path
 * directly to `Path`. We'd have to detect and remove stale entries, etc.
 *
 * So instead, we write a trampoline out to a fixed path, still inside our
 * `AppData` directory but outside the version-specific path. That trampoline
 * just launches the current version's CLI tool. Then, whenever we update, we
 * rewrite the trampoline to point to the new, version-specific path. Bingo
 * bango Bob's your uncle.
 */
function writeBatchScriptCLITrampoline(binPath: string): Promise<void> {
  const versionedPath = resolveVersionedPath(
    binPath,
    'resources/app/static/github.bat'
  )

  const trampoline = `@echo off\n"%~dp0\\${versionedPath}" %*`
  const trampolinePath = Path.join(binPath, 'github.bat')

  return writeFile(trampolinePath, trampoline)
}

function writeShellScriptCLITrampoline(binPath: string): Promise<void> {
  // The path we get from `resolveVersionedPath` is a Win32 relative
  // path (something like `..\app-2.5.0\resources\app\static\github.sh`).
  // We need to make sure it's a POSIX path in order for WSL to be able
  // to resolve it. See https://github.com/desktop/desktop/issues/4998
  const versionedPath = resolveVersionedPath(
    binPath,
    'resources/app/static/github.sh'
  ).replace(/\\/g, '/')

  const trampoline = `#!/usr/bin/env bash
  DIR="$( cd "$( dirname "\$\{BASH_SOURCE[0]\}" )" && pwd )"
  sh "$DIR/${versionedPath}" "$@"`
  const trampolinePath = Path.join(binPath, 'github')

  return writeFile(trampolinePath, trampoline, { encoding: 'utf8', mode: 755 })
}
