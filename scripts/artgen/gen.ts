// 用法：先在临时目录跑 artgen worker（见 worker.ts），然后 npx tsx scripts/artgen/gen.ts [kind] [--force]
// 读取 scripts/artgen/prompts.json，原图存 art-src/（不提交），压缩成 webp 放进 src/client/assets/art/。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MODEL = '@cf/black-forest-labs/flux-2-klein-9b';
const ENDPOINT = process.env.ARTGEN ?? 'http://localhost:8799';
const SIZE: Record<string, [number, number]> = { rooms: [320, 320], explorers: [256, 320], cards: [400, 300], ui: [1024, 0], monsters: [160, 160] };

interface Item { kind: string; id: string; prompt: string; w: number; h: number }
const file = JSON.parse(readFileSync('scripts/artgen/prompts.json', 'utf8')) as { items: Item[] };
const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const force = process.argv.includes('--force');
const ids = process.argv.find((a) => a.startsWith('--ids='))?.slice(6).split(',');

const todo = file.items.filter((it) => (!only || it.kind === only) && (!ids || ids.includes(it.id)) && (force || !existsSync(out(it))));
console.log(`待生成 ${todo.length} 张`);

function out(it: Item) {
  const kind = it.kind === 'ui' && it.id.startsWith('scenario-') ? 'ui' : it.kind;
  return `src/client/assets/art/${kind}/${it.id}.webp`;
}

async function gen(it: Item) {
  const raw = `art-src/${it.kind}/${it.id}.jpg`;
  mkdirSync(`art-src/${it.kind}`, { recursive: true });
  mkdirSync(out(it).replace(/\/[^/]+$/, ''), { recursive: true });
  if (force || !existsSync(raw)) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(ENDPOINT, { method: 'POST', body: JSON.stringify({ model: MODEL, prompt: it.prompt, width: it.w, height: it.h }) });
      if (res.ok) {
        writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
        break;
      }
      const t = await res.text();
      if (attempt >= 2 || /quota|limit|4006|neuron/i.test(t)) throw new Error(`${it.id}: ${t.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const [w, h] = SIZE[it.kind] ?? [512, 0];
  execFileSync('cwebp', ['-quiet', '-q', it.kind === 'ui' ? '70' : '72', '-resize', String(w), String(h), raw, '-o', out(it)]);
}

let done = 0;
let failed = 0;
const queue = [...todo];
async function worker() {
  for (let it = queue.shift(); it; it = queue.shift()) {
    try {
      await gen(it);
      done++;
      console.log(`✓ ${done}/${todo.length} ${it.kind}/${it.id}`);
    } catch (e) {
      failed++;
      console.error('✗', String(e));
      if (/quota|limit|4006|neuron/i.test(String(e))) { queue.length = 0; }
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`完成 ${done}，失败 ${failed}`);
