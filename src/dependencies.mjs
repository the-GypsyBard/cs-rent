import { createRequire } from 'node:module';
import { join } from 'node:path';
const require=createRequire(import.meta.url);
export function getPlaywright() {
  try { return require('playwright'); } catch {}
  const base=process.env.USERPROFILE;
  if(base) try { return require(join(base,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); } catch {}
  throw new Error('缺少 Playwright。请安装 Node.js 24 后在项目目录执行 npm install，或运行 安装依赖.cmd。');
}
