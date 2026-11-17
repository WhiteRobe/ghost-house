import type { LobbyDO } from './lobby';
import type { HouseDO } from './house';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  LOBBY: DurableObjectNamespace<LobbyDO>;
  HOUSE: DurableObjectNamespace<HouseDO>;
  SESSION_SECRET: string;
  PBKDF2_ITERATIONS: string;
  TURN_TIMEOUT_MS: string;
  OFFLINE_TAKEOVER_MS: string;
}

export interface Identity {
  id: string;
  name: string;
  guest: boolean;
}

export function lobbyStub(env: Env) {
  return env.LOBBY.get(env.LOBBY.idFromName('lobby'));
}

export function houseStub(env: Env, roomId: string) {
  return env.HOUSE.get(env.HOUSE.idFromName(roomId));
}
