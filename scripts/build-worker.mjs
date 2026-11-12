import { spawnSync } from 'node:child_process';

if (process.env.WORKERS_CI === '1') {
  console.error('Production deployment for machikoro2 is managed by the validated GitHub Actions workflow. Disconnect the native Cloudflare Builds trigger for this Worker.');
  process.exit(1);
}

const npmCli = process.env.npm_execpath;
const result = npmCli
  ? spawnSync(process.execPath, [npmCli, 'run', 'compile'], { stdio: 'inherit' })
  : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'compile'],
    { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
