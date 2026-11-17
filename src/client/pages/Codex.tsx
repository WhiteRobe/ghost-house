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
      <p>你们几个半夜溜进一栋民国老洋楼。前半局大家是一伙的：轮流在楼里走，打开没开过的门，遇到事件，捡到物品，也会撞上<b>凶兆</b>。</p>
      <p><b>回合</b>：最多走「速度」那么多格。走进一扇没开过的门就会<b>发现新房间</b>：抽一块房间接上去，按房间上的符号抽一张卡，这个回合就结束了。回合里还可以用物品的能力，或者和同一个房间的人交易一次。</p>
      <p><b>属性</b>：速度、力量、理智、知识。检定时掷「属性值」那么多颗骰子，每颗骰子的六个面是 0、0、1、1、2、2。受了伤就沿着属性轨往下走。异变开始前没人会死。</p>
      <p><b>异变</b>：每出一张凶兆，就掷「已出凶兆数」颗骰子，5 点以上触发异变，第 9 张凶兆一定触发。具体是哪个异变、谁当背叛者，看缘起卡和刚出的那张凶兆。</p>
      <p>异变之后，背叛者和幸存者各拿一份只有自己能看的手册，写着要做什么、有哪些特殊规则。哪条规则被用了，所有人都会看到。这时候属性掉到骷髅就会死。和敌人在同一个房间可以<b>攻击</b>：双方掷力量，点数高的给对方造成差值伤害。背叛者不受房间里那些伤人的效果影响，抽到事件也可以选择不管。</p>
      <p>也有没有背叛者、全员合作对付房子的异变；有背叛者藏着身份的；还有人人各管各的。</p>
    </div>
  );
}
