import { TopBar } from '../ui/common';

export function Credits() {
  return (
    <>
      <TopBar />
      <div class="page">
        <div class="panel rules">
          <h3>声明</h3>
          <p>「鬼屋」是一款受桌游《山中小屋》（Betrayal at House on the Hill）规则框架启发的非官方同人作品，仅供个人娱乐，非商业用途。</p>
          <p>游戏中的所有角色、房间、卡牌、剧本文字与美术均为原创，与原作及其出版商无关。</p>
          <p>插画由 AI 生成（Cloudflare Workers AI）。音效与音乐由程序实时合成。</p>
        </div>
      </div>
    </>
  );
}
