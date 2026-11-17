// 美术资源：AI 插画放在 src/client/assets/art/<分类>/<id>.webp，构建时自动收集（带 hash，长缓存）。
// 缺图时返回空字符串，组件回退到纯色背景。
const files = import.meta.glob('./assets/art/*/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const get = (kind: string, id: string) => files[`./assets/art/${kind}/${id}.webp`] ?? '';

export const art = {
  room: (id: string) => get('rooms', id),
  explorer: (id: string) => get('explorers', id),
  card: (id: string) => get('cards', id),
  monster: (icon: string) => get('monsters', icon),
  ui: (name: string) => get('ui', name),
};

export const SIDE_NAME = { hero: '幸存者', traitor: '背叛者', solo: '各自为战' } as const;
