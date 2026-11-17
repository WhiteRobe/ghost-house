import { CARDS, EXPLORERS, ROOMS, SCENARIOS } from '../../content';
import { FLOOR_NAME, TRAITS, TRAIT_NAME } from '../../shared/types';
import { go, route } from '../store';
import { TopBar, Img } from '../ui/common';
import { CardView } from '../game/parts';
import { art } from '../art';

const TABS: [string, string][] = [['explorers', '探险者'], ['rooms', '房间'], ['omen', '凶兆'], ['item', '物品'], ['event', '事件'], ['scenarios', '缘起'], ['rules', '规则']];

export function Codex() {
  const r = route.value;
  const tab = r.name === 'codex' ? r.tab : 'explorers';
  return (
    <>
      <TopBar />
      <div class="page">
        <div class="tabs codex-tabs">{TABS.map(([k, n]) => <button class={k === tab ? 'on' : ''} onClick={() => go('/codex/' + k)}>{n}</button>)}</div>
        {tab === 'explorers' && (
          <div class="ex-grid">
            {Object.values(EXPLORERS).map((ex) => (
              <div class="ex-card">
                <div class="ex-art" style={{ background: ex.color }}><Img src={art.explorer(ex.id)} /></div>
                <div class="ex-body">
                  <b>{ex.name}</b> <span class="muted tiny">{ex.age} 岁 · 生日 {ex.birthday} · {ex.hobbies}</span>
                  <div class="tiny">{ex.bio}</div>
                  {TRAITS.map((t) => (
                    <div class="mini-track"><span>{TRAIT_NAME[t]}</span>{ex.tracks[t].map((v, i) => <i class={ex.start[t] === i + 1 ? 'start' : ''}>{v}</i>)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'rooms' && (
          <div class="room-list">
            {Object.values(ROOMS).map((rm) => (
              <div class="panel room-item">
                <div class="room-thumb"><Img src={art.room(rm.id)} /></div>
                <div>
                  <b>{rm.name}</b> <span class="muted tiny">{rm.floors.map((f) => FLOOR_NAME[f]).join(' / ')}{rm.start ? ' · 起始' : ''}</span>
                  <div class="small">{rm.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {(tab === 'omen' || tab === 'item' || tab === 'event') && (
          <div class="card-grid big">{Object.values(CARDS).filter((c) => c.kind === tab).map((c) => <CardView id={c.id} />)}</div>
        )}
        {tab === 'scenarios' && (
          <div class="col">{Object.values(SCENARIOS).map((sc) => <div class="panel"><b>{sc.name}</b><p class="small">{sc.text}</p></div>)}</div>
        )}
        {tab === 'rules' && <Rules />}
      </div>
    </>
  );
}

function Rules() {
  return (
    <div class="panel rules">
      <h3>怎么玩</h3>
      <p>你们几个人深夜闯进了一栋民国老洋楼。一开始大家是同伴：轮流探索房子，翻开新的房间，遭遇事件、捡到物品、碰上<b>凶兆</b>。</p>
      <p><b>回合</b>：你最多可以走「速度」那么多格。走进一扇还没打开的门，就会<b>发现新房间</b>——抽一块房间板块接上去，按房间上的符号抽卡，然后回合结束。回合中还可以使用物品能力、和同一房间的人交易一次。</p>
      <p><b>属性</b>：速度、力量、理智、知识。检定就是掷「属性值」颗骰子，每颗骰子是 0、0、1、1、2、2。受伤时沿着属性轨往下移。异变开始之前，谁都不会死。</p>
      <p><b>异变</b>：每抽到一张凶兆，就要掷「已出现凶兆数」颗骰子，掷出 5 点以上，房子就醒了（第 9 张凶兆必定触发）。这时根据缘起卡和刚抽到的凶兆，决定发生哪一个异变、谁是<b>背叛者</b>。</p>
      <p>异变之后，背叛者和幸存者各自拿到一份只有自己能看的手册，写着目标和特殊规则。规则一旦被执行就会公开。现在属性降到骷髅就会死，同一房间的敌人可以互相<b>攻击</b>：双方掷力量，点数高的一方对另一方造成差值伤害。</p>
      <p>有的异变没有背叛者，大家必须合作；有的背叛者藏在你们之中；还有的，人人都只为自己。</p>
    </div>
  );
}
