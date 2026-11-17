import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { ROOMS, EXPLORERS } from '../../content';
import { DX, DY, hasDoor, parseKey, tileKey, type Dir, type Floor, type GameState } from '../../shared/types';
import { art } from '../art';
import { lastMoved, hits } from './store';

const T = 120; // 每格像素
const WALL = 7;
const DOOR = 40;

export interface MapProps {
  s: GameState;
  floor: Floor;
  you: number | null;
  moves?: Record<string, number>;
  explore?: Dir[];
  exploreFrom?: string;
  pick?: string[];
  ghost?: { key: string; room: string; rot: number };
  onTile?: (key: string) => void;
  onExplore?: (dir: Dir) => void;
  onInspect?: (key: string) => void;
  /** 切换楼层或决策时把这一格滚到中间 */
  focus?: string | null;
}

export function MapView(p: MapProps) {
  const { s, floor } = p;
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(() => (window.innerWidth < 700 ? 0.65 : 1));
  const tiles = Object.entries(s.tiles).filter(([, t]) => t.floor === floor);
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const [, t] of tiles) {
    minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
    minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
  }
  minX -= 2; minY -= 2; maxX += 2; maxY += 2;
  const W = (maxX - minX + 1) * T;
  const H = (maxY - minY + 1) * T;
  const px = (x: number) => (x - minX) * T;
  const py = (y: number) => (y - minY) * T;

  // 拖拽平移
  const drag = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = box.current!;
    drag.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
  };
  const onMoveP = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    box.current!.scrollLeft = d.sl - dx;
    box.current!.scrollTop = d.st - dy;
  };
  const onUp = () => setTimeout(() => (drag.current = null), 0);
  const click = (f: () => void) => () => { if (!drag.current?.moved) f(); };

  const centerOn = (key: string | null | undefined, smooth = true) => {
    const el = box.current;
    if (!el || !key) return;
    const k = parseKey(key);
    if (k.floor !== floor) return;
    el.scrollTo({ left: (px(k.x) + T / 2) * zoom - el.clientWidth / 2, top: (py(k.y) + T / 2) * zoom - el.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
  };
  const meTile = p.you != null ? s.players[p.you]?.tile : null;
  useLayoutEffect(() => centerOn(p.focus ?? meTile ?? 'G:0,-1', false), [floor]);
  useEffect(() => centerOn(p.focus), [p.focus]);
  useEffect(() => { if (lastMoved.value && parseKey(lastMoved.value).floor === floor) centerOn(lastMoved.value); }, [lastMoved.value]);

  // 每格里的棋子位置
  const slots = (n: number, i: number) => {
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
    const r = Math.floor(i / cols), c = i % cols;
    const rows = Math.ceil(n / cols);
    const gap = 30;
    return [T / 2 + (c - (cols - 1) / 2) * gap, T / 2 - 6 + (r - (rows - 1) / 2) * gap];
  };
  const occupants: Record<string, { id: string; kind: 'p' | 'm'; seat?: number; mid?: number }[]> = {};
  for (const pl of s.players) if (!pl.flags.escaped) (occupants[pl.tile] ??= []).push({ id: 'p' + pl.seat, kind: 'p', seat: pl.seat });
  for (const m of s.monsters) (occupants[m.tile] ??= []).push({ id: 'm' + m.id, kind: 'm', mid: m.id });

  const exploreFrom = p.exploreFrom ? parseKey(p.exploreFrom) : null;

  return (
    <div class="map-wrap">
      <div class="map" ref={box} onPointerDown={onDown as any} onPointerMove={onMoveP as any} onPointerUp={onUp} onPointerLeave={onUp}>
        <svg width={W * zoom} height={H * zoom} viewBox={`0 0 ${W} ${H}`} class={`floor-${floor}`}>
          <defs>
            <radialGradient id="auraGrad"><stop offset="40%" stop-color="#ff2a1a" stop-opacity="0.8" /><stop offset="100%" stop-color="#ff2a1a" stop-opacity="0" /></radialGradient>
            <pattern id="grid" width={T} height={T} patternUnits="userSpaceOnUse">
              <rect width={T} height={T} fill="none" stroke="rgba(240,180,76,0.04)" />
            </pattern>
            <filter id="glow"><feGaussianBlur stdDeviation="4" /></filter>
            <clipPath id="tileclip"><rect x="3" y="3" width={T - 6} height={T - 6} rx="6" /></clipPath>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />

          {tiles.map(([key, t]) => {
            const room = ROOMS[t.room];
            const x = px(t.x), y = py(t.y);
            const can = p.moves && key in p.moves;
            const pick = p.pick?.includes(key);
            const hot = lastMoved.value === key;
            return (
              <g key={key} transform={`translate(${x},${y})`} class={`tile ${can || pick ? 'can' : ''}`}
                onClick={click(() => (can || pick ? p.onTile?.(key) : p.onInspect?.(key)))}>
                <rect x="2" y="2" width={T - 4} height={T - 4} rx="7" class="tile-bg" />
                <g clip-path="url(#tileclip)">
                  {art.room(room.id) && <image href={art.room(room.id)} x="3" y="3" width={T - 6} height={T - 6} preserveAspectRatio="xMidYMid slice"
                    transform={`rotate(${t.rot * 90} ${T / 2} ${T / 2})`} class="tile-img" />}
                  <rect x="3" y={T - 30} width={T - 6} height="27" class="tile-name-bg" />
                </g>
                {walls(room.doors, t.rot)}
                <text x={T / 2} y={T - 11} class="tile-name">{room.name}</text>
                {room.link && <text x={T - 14} y="20" class="tile-badge">⇅</text>}
                {s.tokens.filter((tk) => tk.tile === key).map((tk, i) => (
                  <g transform={`translate(${10 + i * 22}, 10)`} class={`token ${tk.obstacle ? 'obstacle' : ''}`}>
                    <rect width="20" height="20" rx="4" />
                    <text x="10" y="15">{tk.label.slice(0, 1)}</text>
                    <title>{tk.label}</title>
                  </g>
                ))}
                {can && <text x={T - 12} y={T - 34} class="cost">{p.moves![key]}</text>}
                {(can || pick) && <rect x="2" y="2" width={T - 4} height={T - 4} rx="7" class="tile-hl" />}
                {hot && <rect x="2" y="2" width={T - 4} height={T - 4} rx="7" class="tile-hot" />}
              </g>
            );
          })}

          {/* 可探索的门 */}
          {exploreFrom && exploreFrom.floor === floor && p.explore?.map((d, i) => {
            const cx = px(exploreFrom.x + DX[d]) + T / 2, cy = py(exploreFrom.y + DY[d]) + T / 2;
            return (
              <g class="explore" data-tour={i === 0 ? 'explore' : undefined} onClick={click(() => p.onExplore?.(d))} transform={`translate(${cx},${cy})`}>
                <rect x={-T / 2 + 8} y={-T / 2 + 8} width={T - 16} height={T - 16} rx="10" />
                <text y="-4">？</text>
                <text y="20" class="small">探索</text>
              </g>
            );
          })}

          {/* 新房间旋转预览 */}
          {p.ghost && parseKey(p.ghost.key).floor === floor && (() => {
            const g = parseKey(p.ghost!.key);
            const room = ROOMS[p.ghost!.room];
            return (
              <g transform={`translate(${px(g.x)},${py(g.y)})`} class="ghost-tile">
                <rect x="2" y="2" width={T - 4} height={T - 4} rx="7" class="tile-bg" />
                <g clip-path="url(#tileclip)">
                  {art.room(room.id) && <image href={art.room(room.id)} x="3" y="3" width={T - 6} height={T - 6} preserveAspectRatio="xMidYMid slice" transform={`rotate(${p.ghost!.rot * 90} ${T / 2} ${T / 2})`} />}
                </g>
                {walls(room.doors, p.ghost!.rot)}
                <text x={T / 2} y={T - 11} class="tile-name">{room.name}</text>
              </g>
            );
          })()}

          {/* 棋子 */}
          {Object.entries(occupants).flatMap(([key, list]) => {
            const k = parseKey(key);
            if (k.floor !== floor) return [];
            return list.map((o, i) => {
              const [ox, oy] = slots(list.length, i);
              const x = px(k.x) + ox, y = py(k.y) + oy;
              if (o.kind === 'p') {
                const pl = s.players[o.seat!];
                const ex = EXPLORERS[pl.explorer];
                return (
                  <g key={o.id} class={`piece ${pl.dead ? 'dead' : ''} ${s.turn === pl.seat ? 'active' : ''} ${o.seat === p.you ? 'me' : ''}`} style={{ transform: `translate(${x}px,${y}px)` }}>
                    <g class={hits.value['p' + o.seat] ? 'hit' : ''}>
                    {pl.side === 'traitor' && !pl.dead && (
                      <g class="aura">
                        <circle r="27" class="aura-glow" />
                        <circle r="18" class="aura-ring" />
                        {[0, 1, 2, 3, 4, 5, 6].map((i) => <ellipse class={`wisp w${i}`} cx={(i - 3) * 4.5} cy="-10" rx="3.6" ry="7" />)}
                      </g>
                    )}
                    <circle r="14" fill={ex?.color ?? '#888'} />
                    <clipPath id={`pc${o.seat}`}><circle r="12" /></clipPath>
                    {art.explorer(pl.explorer) ? <image href={art.explorer(pl.explorer)} x="-12" y="-12" width="24" height="24" clip-path={`url(#pc${o.seat})`} preserveAspectRatio="xMidYMin slice" /> : <text y="5" class="p-letter">{ex?.name.slice(0, 1)}</text>}
                    <circle r="14" class="ring" />
                    {pl.side === 'traitor' && <circle r="14" class="traitor-ring" />}
                    {pl.side === 'traitor' && <text y="-19" class="traitor-mark">☠</text>}
                    </g>
                    <title>{pl.name}</title>
                  </g>
                );
              }
              const m = s.monsters.find((x) => x.id === o.mid)!;
              return (
                <g key={o.id} class={`piece monster ${m.stunned ? 'stunned' : ''} ${p.pick?.includes('m' + m.id) ? 'pickable' : ''}`} style={{ transform: `translate(${x}px,${y}px)` }}
                  onClick={click(() => p.onTile?.('m' + m.id))}>
                  <g class={`m-body ${hits.value['m' + m.id] ? 'hit' : ''}`}>
                  <rect x="-13" y="-13" width="26" height="26" rx="6" />
                  <clipPath id={`mc${m.id}`}><rect x="-11" y="-11" width="22" height="22" rx="5" /></clipPath>
                  {art.monster(m.icon) ? <image href={art.monster(m.icon)} x="-11" y="-11" width="22" height="22" clip-path={`url(#mc${m.id})`} /> : <text y="5" class="m-letter">{m.name.slice(0, 1)}</text>}
                  </g>
                  {m.hp != null && <text y="26" class="m-hp">{m.hp}</text>}
                  <title>{m.name}{m.stunned ? '（眩晕）' : ''}</title>
                </g>
              );
            });
          })}
        </svg>
      </div>
      <div class="map-tools">
        <button class="icon-btn" onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}>＋</button>
        <button class="icon-btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>－</button>
        <button class="icon-btn" title="回到我的位置" onClick={() => centerOn(meTile)}>◎</button>
      </div>
    </div>
  );
}

/** 墙：没有门的边画实线，有门的边留出门洞 */
function walls(doors: number, rot: number) {
  const out = [];
  const a = 4, b = T - 4;
  const seg: [number, number, number, number][] = [[a, a, b, a], [b, a, b, b], [a, b, b, b], [a, a, a, b]];
  for (let d = 0; d < 4; d++) {
    const [x1, y1, x2, y2] = seg[d];
    if (!hasDoor(doors, rot, d)) {
      out.push(<line x1={x1} y1={y1} x2={x2} y2={y2} class="wall" stroke-width={WALL} />);
    } else {
      const mid = T / 2;
      const h = DOOR / 2;
      if (d === 0 || d === 2) {
        out.push(<line x1={x1} y1={y1} x2={mid - h} y2={y1} class="wall" stroke-width={WALL} />);
        out.push(<line x1={mid + h} y1={y1} x2={x2} y2={y1} class="wall" stroke-width={WALL} />);
        out.push(<line x1={mid - h} y1={y1} x2={mid + h} y2={y1} class="door" />);
      } else {
        out.push(<line x1={x1} y1={y1} x2={x1} y2={mid - h} class="wall" stroke-width={WALL} />);
        out.push(<line x1={x1} y1={mid + h} x2={x1} y2={y2} class="wall" stroke-width={WALL} />);
        out.push(<line x1={x1} y1={mid - h} x2={x1} y2={mid + h} class="door" />);
      }
    }
  }
  return out;
}

export { T as TILE_SIZE, tileKey };
