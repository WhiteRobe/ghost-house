/** sfc32：状态 4 个 uint32，可序列化，确定性。 */
export class Rng {
  s: [number, number, number, number];

  constructor(seed: number | [number, number, number, number]) {
    if (Array.isArray(seed)) this.s = [...seed] as [number, number, number, number];
    else {
      this.s = [0x9e3779b9, 0x243f6a88, 0xb7e15162, seed >>> 0];
      for (let i = 0; i < 15; i++) this.next();
    }
  }

  next(): number {
    let [a, b, c, d] = this.s;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    this.s = [a, b, c, d];
    return t / 4294967296;
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** 鬼屋骰：0/0/1/1/2/2 */
  die(): number {
    return Math.floor(this.int(6) / 2);
  }
}
