/**
 * Locate and import the harness's `@deepseek-ai/dsh-typert-protocol` module.
 *
 * A profile-installed bundle is imported from the profile directory, but the
 * harness packages live in the installed application and are not resolvable by
 * bare specifier from there. They are, however, importable by absolute path.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Candidate `@deepseek-ai` scope directories. */
function candidateRoots() {
  const roots = [];
  const fromEnv = process.env.DSH_HOST_MODULES;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) roots.push(fromEnv);

  // CLI/web installs: process.argv[1] is <dsh>/lib/bin.js.
  const bin = process.argv?.[1];
  if (typeof bin === 'string' && bin.length > 0) {
    const dshPkg = dirname(dirname(bin)); // .../@deepseek-ai/dsh
    roots.push(dirname(dshPkg)); // flat install: .../@deepseek-ai
    roots.push(join(dshPkg, 'node_modules', '@deepseek-ai')); // nested install
  }

  // Electron desktop: the harness payload sits at <resources>/app.asar/dsh.
  if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
    roots.push(join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai'));
  }

  roots.push(join(process.cwd(), 'node_modules', '@deepseek-ai'));
  return [...new Set(roots)];
}

let cached;

/**
 * Import the typert protocol module, which exports `TypertRemoteService`.
 * @returns {Promise<{ root: string, typert: object }>}
 */
export async function loadHostModules() {
  if (cached !== undefined) return cached;
  const failures = [];
  for (const scope of candidateRoots()) {
    const entry = join(scope, 'dsh-typert-protocol', 'lib', 'index.js');
    if (!existsSync(entry)) continue;
    try {
      const typert = await import(pathToFileURL(entry).href);
      cached = { root: scope, typert };
      return cached;
    } catch (error) {
      failures.push(`${entry}: ${error?.message ?? error}`);
    }
  }
  throw new Error(
    'dsh-remote-connector cannot locate @deepseek-ai/dsh-typert-protocol. '
    + `Tried:\n  ${failures.join('\n  ')}\n`
    + 'Set DSH_HOST_MODULES to the @deepseek-ai scope directory.',
  );
}
