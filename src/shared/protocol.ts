// WebSocket / HTTP 协议。服务端与客户端共用。
import type { Answer, GameEvent, GameState, Request, RuleMode, Side } from './types';

// POST /api/register|login {username, password} -> Me
// POST /api/guest -> Me（游客只能和 AI 玩）
// POST /api/logout · GET /api/me
// POST /api/rooms {name, maxSeats, private} -> {id, code}
// POST /api/rooms/join {code} -> {id}
// WS /ws/lobby 大厅 · WS /ws/house/:id 房间与对局

export interface Me {
  id: string;
  name: string;
  guest: boolean;
}

export type SeatInfo =
  | { kind: 'empty' }
  | { kind: 'human'; userId: string; name: string; online: boolean; guest?: boolean; explorer?: string }
  | { kind: 'ai'; name: string; explorer?: string };

export interface RoomSettings {
  scenario: string; // 缘起卡 id 或 'random'
  mode: RuleMode;
  /** 新手教学局：固定一个简单的异变、新手不会当背叛者、不限时 */
  tutorial?: boolean;
}

export interface RoomInfo {
  id: string;
  code: string;
  name: string;
  hostId: string;
  private: boolean;
  guestOnly: boolean;
  status: 'waiting' | 'playing' | 'ended';
  seats: SeatInfo[];
  settings: RoomSettings;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  host: string;
  status: RoomInfo['status'];
  humans: number;
  ais: number;
  maxSeats: number;
  updatedAt: number;
}

export interface Brief {
  side: Side | 'solo';
  goal: string;
  rules: string[];
  win: string;
}

/** 不是你的决策只露出 kind 和 seat */
export type PendingView =
  | { mine: true; req: Request; deadline: number | null }
  | { mine: false; kind: Request['kind']; seat: number; deadline: number | null };

export type ClientMsg =
  | { type: 'hello' }
  | { type: 'answer'; seq: number; answer: Answer }
  | { type: 'setSeat'; seat: number; to: 'empty' | 'ai' | 'me' }
  | { type: 'setExplorer'; seat: number; explorer: string | null }
  | { type: 'settings'; settings: Partial<RoomSettings>; maxSeats?: number }
  | { type: 'kick'; seat: number }
  | { type: 'start' }
  | { type: 'rematch' }
  | { type: 'emote'; e: string }
  | { type: 'leave' };

export type ServerMsg =
  | { type: 'room'; room: RoomInfo; you: number | null }
  | {
      type: 'game';
      seq: number;
      events: GameEvent[];
      full: boolean;
      state: GameState;
      brief: Brief | null;
      side: Side | null;
      pending: PendingView | null;
      you: number | null;
    }
  | { type: 'emote'; seat: number; e: string }
  | { type: 'error'; msg: string };

export type LobbyMsg =
  | { type: 'rooms'; rooms: RoomSummary[] }
  | { type: 'upsert'; room: RoomSummary }
  | { type: 'remove'; id: string };
