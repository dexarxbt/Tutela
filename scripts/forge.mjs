import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundledForge = join(repositoryRoot, '.tools', 'foundry', 'forge.exe');
const executable =
  process.env.FORGE_BIN ||
  (process.platform === 'win32' && existsSync(bundledForge) ? bundledForge : 'forge');
const result = spawnSync(executable, process.argv.slice(2), {
  cwd: repositoryRoot,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(`Unable to run Forge at "${executable}": ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
