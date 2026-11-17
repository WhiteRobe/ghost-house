// 构建后检查：前端产物里不能出现任何异变剧本的秘密文本。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HAUNTS } from '../src/haunts';

const dir = 'dist/client';
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|html|json)$/.test(f)) files.push(p);
  }
};
walk(dir);
const content = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const leaks: string[] = [];
for (const h of Object.values(HAUNTS)) {
  for (const t of [h.hero.goal, h.traitorSide?.goal, h.intro]) {
    if (t && t.length > 8 && content.includes(t.slice(0, 24))) leaks.push(`h${h.id} ${t.slice(0, 24)}`);
  }
}
if (leaks.length) {
  console.error('前端产物泄露了剧本文本：\n' + leaks.join('\n'));
  process.exit(1);
}
console.log(`剧本泄露检查通过（${files.length} 个文件，${Object.keys(HAUNTS).length} 个剧本）`);
