// 本地美术生成器：wrangler dev 跑起来后，POST /gen {model, prompt, width, height, steps} 返回图片字节。
// AI 绑定在本地开发时也会调用远端 Workers AI（消耗账号的免费额度）。
interface Env { AI: Ai }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') return new Response('POST /gen', { status: 405 });
    const b = (await req.json()) as { model: string; prompt: string; width?: number; height?: number; steps?: number; seed?: number };
    try {
      let out: { image?: string };
      if (b.model.includes('flux-2')) {
        const form = new FormData();
        form.append('prompt', b.prompt);
        form.append('width', String(b.width ?? 1024));
        form.append('height', String(b.height ?? 1024));
        if (b.steps) form.append('steps', String(b.steps));
        if (b.seed != null) form.append('seed', String(b.seed));
        const r = new Response(form);
        out = (await env.AI.run(b.model as any, { multipart: { body: r.body, contentType: r.headers.get('content-type') } } as any)) as any;
      } else {
        out = (await env.AI.run(b.model as any, { prompt: b.prompt, steps: b.steps ?? 8, seed: b.seed } as any)) as any;
      }
      if (!out?.image) return new Response('no image: ' + JSON.stringify(out).slice(0, 300), { status: 500 });
      const bin = Uint8Array.from(atob(out.image), (c) => c.charCodeAt(0));
      return new Response(bin, { headers: { 'content-type': 'image/jpeg' } });
    } catch (e) {
      return new Response('error: ' + String((e as Error)?.message ?? e), { status: 500 });
    }
  },
};
