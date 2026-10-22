/* CHAOS.exe - tiny 3x5 pixel font for in-world text (damage numbers, shouts). Text is cached to canvases. */
(function (CH) {
  'use strict';

  const G = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '!': '010010010000010', '?': '110001010000010', '.': '000000000000010', ',': '000000000010100',
    '+': '000010111010000', '-': '000000111000000', x: '000101010101000', '*': '000101010101000',
    '%': '101001010100101', ':': '000010000010000', '/': '001001010100100', "'": '010010000000000',
    $: '011110010011110', '#': '101111101111101', '(': '001010010010001', ')': '100010010010100',
    '=': '000111000111000', '<': '001010100010001', '>': '100010001010100',
  };

  const cache = new Map();

  function render(text, color, scale, outline) {
    const w = (text.length * 4 - 1) * scale + (outline ? 2 : 0);
    const h = 5 * scale + (outline ? 2 : 0);
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = h;
    const g = c.getContext('2d');
    const off = outline ? 1 : 0;
    const pass = (col, dx, dy) => {
      g.fillStyle = col;
      for (let i = 0; i < text.length; i++) {
        const bits = G[text[i]] || G[text[i].toUpperCase()];
        if (!bits) continue;
        for (let p = 0; p < 15; p++) {
          if (bits[p] === '1') g.fillRect((i * 4 + (p % 3)) * scale + off + dx, Math.floor(p / 3) * scale + off + dy, scale, scale);
        }
      }
    };
    if (outline) {
      pass('#1b1226', -1, 0);
      pass('#1b1226', 1, 0);
      pass('#1b1226', 0, -1);
      pass('#1b1226', 0, 1);
    }
    pass(color, 0, 0);
    return c;
  }

  const Font = (CH.Font = {
    width: (text, scale) => (text.length * 4 - 1) * (scale || 1),
    get(text, color, scale, outline) {
      scale = scale || 1;
      const key = text + '|' + color + '|' + scale + '|' + (outline ? 1 : 0);
      let c = cache.get(key);
      if (!c) {
        if (cache.size > 600) cache.clear();
        c = render(text, color, scale, outline);
        cache.set(key, c);
      }
      return c;
    },
    /* centered at x by default */
    draw(ctx, text, x, y, color, scale, outline, align) {
      const c = Font.get(String(text), color || '#fff', scale || 1, outline !== false);
      let dx = x;
      if (align !== 'left') dx = x - c.width / 2;
      ctx.drawImage(c, Math.round(dx), Math.round(y));
    },
  });
})(window.CH);
