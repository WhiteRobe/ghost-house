import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { lazy } from './ui/lazy';
import './styles.css';
import { me, route, toastMsg } from './store';
import { api } from './api';
import { Login } from './pages/Login';
import { Lobby } from './pages/Lobby';
import { startMusic } from './audio';

const Room = lazy<{ id: string }>(() => import('./pages/Room').then((m) => m.Room));
const Codex = lazy(() => import('./pages/Codex').then((m) => m.Codex));
const Credits = lazy(() => import('./pages/Credits').then((m) => m.Credits));

function App() {
  useEffect(() => {
    api.me().then((u) => (me.value = u)).catch(() => (me.value = null));
  }, []);
  const r = route.value;
  const u = me.value;
  useEffect(() => { if (r.name !== 'room') startMusic('lobby'); }, [r.name]);

  let page;
  if (r.name === 'codex') page = <Codex />;
  else if (r.name === 'credits') page = <Credits />;
  else if (u === undefined) page = <div class="hero"><div class="empty-hint">加载中…</div></div>;
  else if (!u) page = <Login />;
  else if (r.name === 'room') page = <Room id={r.id} key={r.id} />;
  else page = <Lobby />;

  return (
    <>
      {page}
      {toastMsg.value && <div class="toast">{toastMsg.value}</div>}
    </>
  );
}

render(<App />, document.getElementById('app')!);
