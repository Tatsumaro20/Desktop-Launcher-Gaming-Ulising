/* Geradores procedurais de papel de parede.
 * Cada gerador recebe (ctx, w, h, opts, rand) e desenha numa tela de qualquer
 * resolução — as medidas são relativas a U (1 unidade = altura/1080).
 */
(function () {
  'use strict';

  // ---------- utilidades ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function linear(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function radial(ctx, x, y, r, stops) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function verticalStops(colors) {
    return colors.map((c, i) => [i / (colors.length - 1), c]);
  }
  function setGlow(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow(ctx) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
  function vignette(ctx, w, h, strength) {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, Math.hypot(w, h) / 2, [
      [0.5, 'rgba(0,0,0,0)'],
      [1, `rgba(0,0,0,${strength})`],
    ]);
    ctx.fillRect(0, 0, w, h);
  }
  function grain(ctx, w, h, rand, amount, light) {
    const n = Math.round((w * h) / 900 * amount);
    const s = Math.max(1, Math.round(h / 1080));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = light ? `rgba(255,255,255,${rand() * 0.05})` : `rgba(0,0,0,${rand() * 0.06})`;
      ctx.fillRect(rand() * w, rand() * h, s, s);
    }
  }
  function stars(ctx, w, h, rand, count, maxY, color) {
    const U = h / 1080;
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = Math.pow(rand(), 1.4) * maxY;
      const r = (rand() < 0.94 ? rand() * 1.2 + 0.3 : rand() * 1.8 + 1.4) * U;
      ctx.fillStyle = rgba(color || '#ffffff', 0.25 + rand() * 0.75);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function perspectiveGrid(ctx, w, h, horizon, color, alpha, U) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.clip();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 1.6 * U;
    setGlow(ctx, rgba(color, 0.9), 12 * U);
    const vx = w / 2;
    for (let i = -24; i <= 24; i++) {
      ctx.beginPath();
      ctx.moveTo(vx, horizon);
      ctx.lineTo(vx + i * (w / 10), h);
      ctx.stroke();
    }
    const rows = 16;
    for (let i = 1; i <= rows; i++) {
      const y = horizon + (h - horizon) * Math.pow(i / rows, 2.2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    noGlow(ctx);
    ctx.fillStyle = linear(ctx, 0, horizon, 0, horizon + (h - horizon) * 0.45, [
      [0, rgba(color, 0.35)],
      [1, rgba(color, 0)],
    ]);
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.restore();
  }

  // ---------- geradores ----------
  const generators = {};

  /* Gamer: estilhaços angulares neon + grade em perspectiva + hexágonos. */
  generators.angular = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    const [n1, n2, n3] = o.neon;
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, verticalStops(o.bg));
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = radial(ctx, w / 2, h * 0.5, h * 0.75, [[0, rgba(n1, 0.28)], [1, rgba(n1, 0)]]);
    ctx.fillRect(0, 0, w, h);

    // hexágonos
    const r = 34 * U;
    const hw = Math.sqrt(3) * r;
    ctx.lineWidth = 1.2 * U;
    for (let row = 0, y = 0; y < h * 0.66; row++, y = row * r * 1.5) {
      for (let x = (row % 2) * hw / 2; x < w + hw; x += hw) {
        const a = rand() * 0.12 * (1 - y / (h * 0.66));
        if (a < 0.015) continue;
        ctx.strokeStyle = rgba(rand() < 0.85 ? n2 : n1, a);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = Math.PI / 6 + (k * Math.PI) / 3;
          const px = x + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    perspectiveGrid(ctx, w, h, h * 0.64, n2, 0.4, U);

    // linhas de velocidade
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const c = [n1, n2, n3][Math.floor(rand() * 3)];
      const x = rand() * w * 1.2 - w * 0.1;
      const y = rand() * h * 0.62;
      const len = (60 + rand() * 360) * U;
      ctx.strokeStyle = rgba(c, 0.25 + rand() * 0.6);
      ctx.lineWidth = (1 + rand() * 2.5) * U;
      setGlow(ctx, c, 14 * U);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y - len * 0.36);
      ctx.stroke();
    }

    // emblema central em V
    const cx = w / 2;
    const cy = h * 0.42;
    const s = 210 * U;
    const shard = (pts, fill, stroke) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3 * U;
      setGlow(ctx, stroke, 30 * U);
      ctx.stroke();
    };
    shard([[-1.3, -0.9], [-0.35, -0.9], [0, 0.15], [0, 1.0]], linear(ctx, cx - s, cy - s, cx, cy + s, [[0, rgba(n1, 0.55)], [1, rgba(n1, 0.05)]]), n1);
    shard([[1.3, -0.9], [0.35, -0.9], [0, 0.15], [0, 1.0]], linear(ctx, cx + s, cy - s, cx, cy + s, [[0, rgba(n2, 0.55)], [1, rgba(n2, 0.05)]]), n2);
    shard([[-0.2, -0.9], [0.2, -0.9], [0, -0.35]], rgba(n3, 0.6), n3);
    noGlow(ctx);

    // faixas diagonais nas bordas
    [[0, n1], [1, n2]].forEach(([side, c]) => {
      ctx.fillStyle = linear(ctx, 0, 0, w, 0, side ? [[0.7, rgba(c, 0)], [1, rgba(c, 0.35)]] : [[0, rgba(c, 0.35)], [0.3, rgba(c, 0)]]);
      ctx.beginPath();
      if (!side) {
        ctx.moveTo(0, h * 0.15); ctx.lineTo(w * 0.25, 0); ctx.lineTo(w * 0.29, 0); ctx.lineTo(0, h * 0.24);
      } else {
        ctx.moveTo(w, h * 0.85); ctx.lineTo(w * 0.75, h); ctx.lineTo(w * 0.71, h); ctx.lineTo(w, h * 0.76);
      }
      ctx.fill();
    });

    vignette(ctx, w, h, 0.65);
  };

  /* Cidade: cyberpunk com chuva ou noite lo-fi com lua. */
  generators.city = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, verticalStops(o.sky));
    ctx.fillRect(0, 0, w, h);
    if (o.stars) stars(ctx, w, h, rand, 420, h * 0.6);

    if (o.moon) {
      const mx = w * 0.74, my = h * 0.26, mr = 120 * U;
      ctx.fillStyle = radial(ctx, mx, my, mr * 3.2, [[0, rgba(o.moon, 0.45)], [1, rgba(o.moon, 0)]]);
      ctx.fillRect(0, 0, w, h);
      setGlow(ctx, o.moon, 60 * U);
      ctx.fillStyle = o.moon;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      noGlow(ctx);
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.beginPath();
        ctx.arc(mx + (rand() - 0.5) * mr * 1.2, my + (rand() - 0.5) * mr * 1.2, (8 + rand() * 22) * U, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (o.shootingStars) {
      for (let i = 0; i < 3; i++) {
        const x = w * (0.1 + rand() * 0.5), y = h * (0.05 + rand() * 0.25), l = (120 + rand() * 160) * U;
        ctx.strokeStyle = linear(ctx, x, y, x + l, y + l * 0.4, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.9)']]);
        ctx.lineWidth = 2 * U;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + l * 0.4); ctx.stroke();
      }
    }

    // névoa no horizonte
    ctx.fillStyle = linear(ctx, 0, h * 0.45, 0, h, [[0, rgba(o.neon[0], 0)], [1, rgba(o.neon[0], 0.35)]]);
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    const layers = [
      { color: o.buildings[0], minH: 0.22, maxH: 0.55, minW: 40, maxW: 110, windows: 0.18 },
      { color: o.buildings[1], minH: 0.15, maxH: 0.42, minW: 70, maxW: 170, windows: 0.32 },
      { color: o.buildings[2], minH: 0.08, maxH: 0.3, minW: 110, maxW: 240, windows: 0.4 },
    ];
    layers.forEach((L, li) => {
      let x = -20 * U;
      while (x < w) {
        const bw = (L.minW + rand() * (L.maxW - L.minW)) * U;
        const bh = h * (L.minH + rand() * (L.maxH - L.minH));
        const top = h - bh;
        ctx.fillStyle = L.color;
        ctx.fillRect(x, top, bw, bh);
        if (rand() < 0.3) {
          // antena
          ctx.fillRect(x + bw * 0.5 - 1.5 * U, top - 40 * U, 3 * U, 40 * U);
          ctx.fillStyle = o.neon[1];
          setGlow(ctx, o.neon[1], 10 * U);
          ctx.beginPath(); ctx.arc(x + bw * 0.5, top - 40 * U, 3 * U, 0, Math.PI * 2); ctx.fill();
          noGlow(ctx);
        }
        // janelas
        const ww = (4 + li * 2) * U, wh = (6 + li * 2) * U, gap = (8 + li * 3) * U;
        for (let wy = top + gap; wy < h - gap; wy += wh + gap) {
          for (let wx = x + gap * 0.7; wx < x + bw - ww - gap * 0.5; wx += ww + gap) {
            if (rand() < L.windows) {
              const c = o.windows[Math.floor(rand() * o.windows.length)];
              ctx.fillStyle = rgba(c, 0.35 + rand() * 0.55);
              ctx.fillRect(wx, wy, ww, wh);
            }
          }
        }
        // letreiro neon vertical
        if (li > 0 && rand() < 0.28) {
          const c = o.neon[Math.floor(rand() * o.neon.length)];
          const sx = x + bw * (0.15 + rand() * 0.6), sy = top + bh * 0.12, sh = bh * (0.2 + rand() * 0.25);
          ctx.fillStyle = rgba(c, 0.9);
          setGlow(ctx, c, 26 * U);
          ctx.fillRect(sx, sy, 10 * U, sh);
          noGlow(ctx);
        }
        x += bw + rand() * 6 * U;
      }
      // névoa entre camadas
      ctx.fillStyle = linear(ctx, 0, h * 0.55, 0, h, [[0, rgba(o.sky[o.sky.length - 1], 0)], [1, rgba(o.sky[o.sky.length - 1], 0.18)]]);
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    });

    if (o.rain) {
      ctx.lineWidth = 1.2 * U;
      for (let i = 0; i < 900; i++) {
        const x = rand() * w * 1.1, y = rand() * h, l = (14 + rand() * 30) * U;
        ctx.strokeStyle = `rgba(200,230,255,${0.05 + rand() * 0.18})`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.25, y + l); ctx.stroke();
      }
    }
    vignette(ctx, w, h, 0.55);
  };

  /* Tecnológico: chip central com trilhas de circuito. */
  generators.circuit = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    ctx.fillStyle = radial(ctx, w / 2, h / 2, Math.hypot(w, h) / 1.6, [[0, o.bg[0]], [1, o.bg[1]]]);
    ctx.fillRect(0, 0, w, h);

    const g = 30 * U;
    const cols = Math.ceil(w / g), rows = Math.ceil(h / g);
    const used = new Set();
    const key = (c, r) => c + ',' + r;
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    const chipW = 8, chipH = 6;
    for (let c = cx - chipW - 1; c <= cx + chipW + 1; c++) for (let r = cy - chipH - 1; r <= cy + chipH + 1; r++) used.add(key(c, r));

    // grade de pontos
    ctx.fillStyle = rgba(o.line, 0.08);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) ctx.fillRect(c * g - U, r * g - U, 2 * U, 2 * U);

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    function trace(c, r, dir, bright) {
      const pts = [[c, r]];
      let steps = 6 + Math.floor(rand() * 26);
      while (steps-- > 0) {
        if (rand() < 0.18) {
          const options = dirs.filter((d) => !(d[0] === -dir[0] && d[1] === -dir[1]) && (d[0] * dir[0] + d[1] * dir[1]) >= 0);
          dir = options[Math.floor(rand() * options.length)];
        }
        const nc = c + dir[0], nr = r + dir[1];
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || used.has(key(nc, nr))) break;
        used.add(key(nc, nr));
        c = nc; r = nr;
        pts.push([c, r]);
      }
      if (pts.length < 3) return;
      const color = bright ? o.glow : o.line;
      ctx.strokeStyle = rgba(color, bright ? 0.9 : 0.35 + rand() * 0.3);
      ctx.lineWidth = (bright ? 2.4 : 1.6) * U;
      setGlow(ctx, color, (bright ? 18 : 6) * U);
      ctx.beginPath();
      pts.forEach(([pc, pr], i) => (i ? ctx.lineTo(pc * g, pr * g) : ctx.moveTo(pc * g, pr * g)));
      ctx.stroke();
      const [ec, er] = pts[pts.length - 1];
      ctx.fillStyle = o.bg[1];
      ctx.beginPath(); ctx.arc(ec * g, er * g, 5 * U, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2 * U; ctx.stroke();
      if (bright || rand() < 0.3) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(ec * g, er * g, 2.2 * U, 0, Math.PI * 2); ctx.fill();
      }
      noGlow(ctx);
    }

    // trilhas saindo do chip
    for (let c = cx - chipW + 1; c < cx + chipW; c += 2) {
      trace(c, cy - chipH - 1, [0, -1], rand() < 0.3);
      trace(c, cy + chipH + 1, [0, 1], rand() < 0.3);
    }
    for (let r = cy - chipH + 1; r < cy + chipH; r += 2) {
      trace(cx - chipW - 1, r, [-1, 0], rand() < 0.3);
      trace(cx + chipW + 1, r, [1, 0], rand() < 0.3);
    }
    // trilhas soltas
    for (let i = 0; i < cols * rows * 0.02; i++) {
      const c = Math.floor(rand() * cols), r = Math.floor(rand() * rows);
      if (!used.has(key(c, r))) { used.add(key(c, r)); trace(c, r, dirs[Math.floor(rand() * 4)], rand() < 0.06); }
    }

    // chip
    const x0 = (cx - chipW) * g, y0 = (cy - chipH) * g, cw = chipW * 2 * g, ch = chipH * 2 * g;
    ctx.fillStyle = linear(ctx, x0, y0, x0 + cw, y0 + ch, [[0, mix(o.bg[0], o.glow, 0.12)], [1, o.bg[1]]]);
    setGlow(ctx, o.glow, 40 * U);
    ctx.fillRect(x0, y0, cw, ch);
    ctx.strokeStyle = o.glow;
    ctx.lineWidth = 3 * U;
    ctx.strokeRect(x0, y0, cw, ch);
    noGlow(ctx);
    ctx.strokeStyle = rgba(o.glow, 0.4);
    ctx.lineWidth = 1.2 * U;
    ctx.strokeRect(x0 + g * 0.6, y0 + g * 0.6, cw - g * 1.2, ch - g * 1.2);
    // núcleo
    ctx.fillStyle = radial(ctx, x0 + cw / 2, y0 + ch / 2, ch * 0.5, [[0, rgba(o.glow, 0.55)], [1, rgba(o.glow, 0)]]);
    ctx.fillRect(x0, y0, cw, ch);
    ctx.strokeStyle = rgba(o.glow, 0.85);
    ctx.lineWidth = 2 * U;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x0 + cw / 2, y0 + ch / 2, (36 + i * 34) * U, -Math.PI / 2 + i, Math.PI * (0.9 + i * 0.3) + i);
      ctx.stroke();
    }
    vignette(ctx, w, h, 0.6);
  };

  /* Hacker: chuva de código. */
  generators.code = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, o.bg[0]], [1, o.bg[1]]]);
    ctx.fillRect(0, 0, w, h);
    const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789<>{}[]#$%=+*';
    const fs = Math.round(20 * U);
    ctx.font = `${fs}px "Consolas", "MS Gothic", "Yu Gothic", monospace`;
    ctx.textBaseline = 'top';
    const cols = Math.ceil(w / fs);
    for (let c = 0; c < cols; c++) {
      const streams = 1 + (rand() < 0.6 ? 1 : 0) + (rand() < 0.2 ? 1 : 0);
      for (let s = 0; s < streams; s++) {
        const head = Math.floor(rand() * (h / fs + 20));
        const len = 6 + Math.floor(rand() * 34);
        const depth = 0.5 + rand() * 0.5;
        for (let i = 0; i < len; i++) {
          const row = head - i;
          if (row < 0) break;
          const ch = chars[Math.floor(rand() * chars.length)];
          const a = (1 - i / len) * depth;
          if (i === 0) {
            ctx.fillStyle = rgba(o.head, Math.min(1, depth + 0.2));
            setGlow(ctx, o.color, 16 * U);
          } else {
            ctx.fillStyle = rgba(o.color, a * 0.85);
            if (i === 1) noGlow(ctx);
          }
          ctx.fillText(ch, c * fs, row * fs);
        }
        noGlow(ctx);
      }
    }
    ctx.fillStyle = radial(ctx, w / 2, h / 2, h * 0.7, [[0, rgba(o.color, 0.12)], [1, rgba(o.color, 0)]]);
    ctx.fillRect(0, 0, w, h);
    // linhas de varredura
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 4 * U) ctx.fillRect(0, y, w, 1.4 * U);
    vignette(ctx, w, h, 0.75);
  };

  /* Ondas: camadas preenchidas (minimalista) e/ou fita de linhas (tech). */
  generators.waves = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    ctx.fillStyle = linear(ctx, 0, 0, w * 0.3, h, verticalStops(o.bg));
    ctx.fillRect(0, 0, w, h);

    if (o.layers) {
      o.layers.forEach((color, i) => {
        const base = h * (0.42 + i * (0.5 / o.layers.length));
        const a1 = (30 + rand() * 50) * U, a2 = (10 + rand() * 30) * U;
        const f1 = (0.6 + rand() * 1.4) / w * Math.PI * 2, f2 = (2 + rand() * 3) / w * Math.PI * 2;
        const p1 = rand() * 6, p2 = rand() * 6;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 6 * U) ctx.lineTo(x, base + Math.sin(x * f1 + p1) * a1 + Math.sin(x * f2 + p2) * a2);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = color;
        if (o.softShadow) setGlow(ctx, 'rgba(0,0,0,0.18)', 40 * U);
        ctx.fill();
        noGlow(ctx);
      });
    }

    if (o.ribbon) {
      const n = 90;
      const f = (1.2 + rand()) / w * Math.PI * 2;
      const p = rand() * 6;
      ctx.lineWidth = 1.3 * U;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const c = t < 0.5 ? mix(o.ribbon[0], o.ribbon[1], t * 2) : mix(o.ribbon[1], o.ribbon[2], (t - 0.5) * 2);
        ctx.strokeStyle = rgba(c, 0.25 + 0.5 * Math.sin(t * Math.PI));
        if (i % 10 === 0) setGlow(ctx, c, 14 * U);
        ctx.beginPath();
        for (let x = -10; x <= w + 10; x += 8 * U) {
          const amp = (140 + 110 * Math.sin(t * Math.PI)) * U;
          const y = h * 0.55 + Math.sin(x * f + p + t * 1.6) * amp * (0.6 + 0.4 * Math.sin(x / w * Math.PI)) + (t - 0.5) * 120 * U;
          if (x < 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        noGlow(ctx);
      }
      // partículas
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = rgba(o.ribbon[Math.floor(rand() * 3)], rand() * 0.7);
        ctx.beginPath(); ctx.arc(rand() * w, rand() * h, rand() * 2.2 * U, 0, Math.PI * 2); ctx.fill();
      }
      vignette(ctx, w, h, 0.5);
    }
    grain(ctx, w, h, rand, 0.6, o.lightGrain);
  };

  /* Minimalista: formas geométricas suaves. */
  generators.shapes = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, verticalStops(o.bg));
    ctx.fillRect(0, 0, w, h);

    // sol
    const sx = w * (0.6 + rand() * 0.15), sy = h * 0.46, sr = 210 * U;
    setGlow(ctx, rgba(o.sun, 0.35), 80 * U);
    ctx.fillStyle = o.sun;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);

    // arco
    ctx.strokeStyle = o.line;
    ctx.lineWidth = 2 * U;
    ctx.beginPath(); ctx.arc(w * 0.32, h * 0.72, 300 * U, Math.PI, Math.PI * 2); ctx.stroke();

    // morros
    o.hills.forEach((color, i) => {
      const base = h * (0.68 + i * 0.09);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, base);
      const peaks = 2 + i;
      for (let k = 0; k <= peaks; k++) {
        const x = (k / peaks) * w;
        const y = base - (k % 2 ? (60 + rand() * 90) * U : rand() * 30 * U);
        ctx.quadraticCurveTo(x - w / peaks / 2, y, x, base - rand() * 20 * U);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });

    // detalhes: ponto e linha
    ctx.fillStyle = o.line;
    ctx.beginPath(); ctx.arc(w * 0.18, h * 0.22, 9 * U, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(w * 0.18 - 0.75 * U, h * 0.22 + 26 * U, 1.5 * U, 180 * U);
    grain(ctx, w, h, rand, 1.2, o.lightGrain);
  };

  /* Anime: pôr do sol com monte, lago, nuvens e galho de sakura. */
  generators.sakura = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    ctx.fillStyle = linear(ctx, 0, 0, 0, h * 0.7, verticalStops(o.sky));
    ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h, rand, 120, h * 0.25);

    // sol
    const sunX = w * 0.55, sunY = h * 0.6;
    ctx.fillStyle = radial(ctx, sunX, sunY, h * 0.6, [[0, rgba(o.sun, 0.7)], [0.25, rgba(o.sun, 0.25)], [1, rgba(o.sun, 0)]]);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = o.sun;
    ctx.beginPath(); ctx.arc(sunX, sunY, 90 * U, 0, Math.PI * 2); ctx.fill();

    // nuvens estilo anime
    function cloud(x, y, s, color) {
      const step = 46 * s * U;
      const puffs = 5 + Math.floor(rand() * 4);
      const half = (puffs - 1) / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < puffs; i++) {
        const px = x + (i - half) * step;
        const py = y - Math.sin((i / (puffs - 1)) * Math.PI) * 38 * s * U;
        const r = (34 + rand() * 24) * s * U;
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, Math.PI * 2);
      }
      ctx.moveTo(x + half * step + 40 * s * U, y + 6 * s * U);
      ctx.ellipse(x, y + 6 * s * U, half * step + 40 * s * U, 24 * s * U, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 7; i++) {
      cloud(rand() * w, h * (0.12 + rand() * 0.3), 0.6 + rand() * 1.0, rgba(o.cloud, 0.35 + rand() * 0.4));
    }

    const horizon = h * 0.7;
    // montanha
    const peakX = w * 0.42, peakY = h * 0.34;
    ctx.fillStyle = linear(ctx, 0, peakY, 0, horizon, [[0, o.mountain[0]], [1, o.mountain[1]]]);
    ctx.beginPath();
    ctx.moveTo(w * -0.05, horizon);
    ctx.quadraticCurveTo(peakX - w * 0.22, horizon - h * 0.08, peakX - w * 0.05, peakY + h * 0.02);
    ctx.lineTo(peakX + w * 0.05, peakY + h * 0.02);
    ctx.quadraticCurveTo(peakX + w * 0.24, horizon - h * 0.08, w * 0.95, horizon);
    ctx.closePath();
    ctx.fill();
    // neve
    ctx.fillStyle = o.snow;
    ctx.beginPath();
    ctx.moveTo(peakX - w * 0.05, peakY + h * 0.02);
    ctx.lineTo(peakX + w * 0.05, peakY + h * 0.02);
    ctx.lineTo(peakX + w * 0.085, peakY + h * 0.09);
    for (let i = 0; i <= 8; i++) {
      const x = peakX + w * 0.085 - (i / 8) * w * 0.17;
      ctx.lineTo(x, peakY + h * (i % 2 ? 0.075 : 0.11) + rand() * 10 * U);
    }
    ctx.closePath();
    ctx.fill();

    // colinas
    o.hills.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let x = 0; x <= w; x += 20 * U) {
        ctx.lineTo(x, horizon - (20 + i * 10) * U - Math.abs(Math.sin(x / w * (3 + i) + i)) * (40 - i * 12) * U);
      }
      ctx.lineTo(w, horizon);
      ctx.closePath();
      ctx.fill();
    });

    // lago com reflexo
    ctx.fillStyle = linear(ctx, 0, horizon, 0, h, [[0, o.water[0]], [1, o.water[1]]]);
    ctx.fillRect(0, horizon, w, h - horizon);
    for (let i = 0; i < 70; i++) {
      const y = horizon + Math.pow(rand(), 1.5) * (h - horizon);
      const x = sunX + (rand() - 0.5) * (120 + (y - horizon) * 0.9);
      ctx.fillStyle = rgba(o.sun, 0.25 + rand() * 0.5);
      ctx.fillRect(x, y, (20 + rand() * 80) * U, 2 * U);
    }

    // galho de sakura
    function branch(x, y, ang, len, width, depth) {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.strokeStyle = o.branch;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + x2) / 2 + (rand() - 0.5) * len * 0.3, (y + y2) / 2 + (rand() - 0.5) * len * 0.3, x2, y2);
      ctx.stroke();
      if (depth <= 0 || width < 1.5 * U) {
        blossoms(x2, y2, 4 + Math.floor(rand() * 6));
        return;
      }
      const n = 2 + (rand() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        branch(x2, y2, ang + (rand() - 0.5) * 1.1, len * (0.62 + rand() * 0.2), width * 0.66, depth - 1);
      }
      if (rand() < 0.5) blossoms(x2, y2, 3);
    }
    function blossoms(x, y, n) {
      for (let i = 0; i < n; i++) {
        const bx = x + (rand() - 0.5) * 50 * U, by = y + (rand() - 0.5) * 40 * U, r = (7 + rand() * 9) * U;
        ctx.fillStyle = rgba(o.petal[Math.floor(rand() * o.petal.length)], 0.85 + rand() * 0.15);
        setGlow(ctx, rgba(o.petal[0], 0.6), 10 * U);
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 + rand();
          ctx.beginPath();
          ctx.ellipse(bx + Math.cos(a) * r * 0.6, by + Math.sin(a) * r * 0.6, r * 0.62, r * 0.42, a, 0, Math.PI * 2);
          ctx.fill();
        }
        noGlow(ctx);
        ctx.fillStyle = o.branch;
        ctx.beginPath(); ctx.arc(bx, by, r * 0.18, 0, Math.PI * 2); ctx.fill();
      }
    }
    branch(-20 * U, h * 0.06, 0.32, 300 * U, 26 * U, 5);
    branch(w + 20 * U, h * 0.02, Math.PI - 0.5, 200 * U, 16 * U, 4);

    // pétalas caindo
    for (let i = 0; i < 140; i++) {
      const x = rand() * w, y = rand() * h, r = (4 + rand() * 7) * U;
      ctx.fillStyle = rgba(o.petal[Math.floor(rand() * o.petal.length)], 0.5 + rand() * 0.5);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    vignette(ctx, w, h, 0.35);
  };

  /* Retrowave: sol listrado, montanhas wireframe e grade. */
  generators.synthwave = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    const horizon = h * 0.64;
    ctx.fillStyle = linear(ctx, 0, 0, 0, horizon, verticalStops(o.sky));
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = o.ground;
    ctx.fillRect(0, horizon, w, h - horizon);
    stars(ctx, w, h, rand, 260, horizon * 0.7);

    // sol listrado (desenhado numa tela auxiliar para recortar as faixas)
    const sr = 260 * U;
    const sun = document.createElement('canvas');
    sun.width = Math.ceil(sr * 2); sun.height = Math.ceil(sr * 2);
    const sctx = sun.getContext('2d');
    sctx.fillStyle = linear(sctx, 0, 0, 0, sr * 2, verticalStops(o.sun));
    sctx.beginPath(); sctx.arc(sr, sr, sr, 0, Math.PI * 2); sctx.fill();
    sctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) {
      const y = sr * 0.9 + i * sr * 0.14;
      sctx.fillRect(0, y, sr * 2, (5 + i * 3.2) * U);
    }
    const sunTop = horizon - sr * 1.7;
    ctx.fillStyle = radial(ctx, w / 2, sunTop + sr, sr * 2.1, [[0.4, rgba(o.sun[1], 0.45)], [1, rgba(o.sun[1], 0)]]);
    ctx.fillRect(0, 0, w, horizon);
    ctx.drawImage(sun, w / 2 - sr, sunTop);

    // montanhas
    [[o.mountain[0], 0.22, 0.6], [o.mountain[1], 0.14, 1]].forEach(([color, height, alpha]) => {
      const pts = [];
      for (let x = 0; x <= w; x += w / 26) {
        const center = Math.abs(x - w / 2) / (w / 2);
        const peak = center < 0.3 ? 0.08 : 1;
        pts.push([x, horizon - (rand() * 0.8 + 0.2) * h * height * peak]);
      }
      ctx.fillStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(w, horizon);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(o.grid, 0.75 * alpha);
      ctx.lineWidth = 1.6 * U;
      setGlow(ctx, o.grid, 10 * U);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      pts.forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 60 * U, horizon); ctx.stroke(); });
      noGlow(ctx);
    });

    perspectiveGrid(ctx, w, h, horizon, o.grid, 0.75, U);
    ctx.fillStyle = linear(ctx, 0, horizon - 6 * U, 0, horizon + 6 * U, [[0, rgba(o.sun[1], 0)], [0.5, rgba(o.sun[1], 0.9)], [1, rgba(o.sun[1], 0)]]);
    ctx.fillRect(0, horizon - 6 * U, w, 12 * U);
    vignette(ctx, w, h, 0.5);
  };

  /* Pixel art: paisagem 8-bit desenhada em baixa resolução e ampliada. */
  generators.pixel = function (ctx, w, h, o, rand) {
    const px = Math.max(4, Math.round(h / 180));
    const lw = Math.ceil(w / px), lh = Math.ceil(h / px);
    const c = document.createElement('canvas');
    c.width = lw; c.height = lh;
    const p = c.getContext('2d');
    // céu em faixas
    const bands = o.sky.length;
    for (let i = 0; i < bands; i++) {
      p.fillStyle = o.sky[i];
      p.fillRect(0, Math.floor((i / bands) * lh * 0.75), lw, Math.ceil(lh * 0.75 / bands) + 1);
    }
    // estrelas
    for (let i = 0; i < lw * 0.6; i++) {
      p.fillStyle = rand() < 0.15 ? '#ffffff' : rgba('#ffffff', 0.5);
      p.fillRect(Math.floor(rand() * lw), Math.floor(rand() * lh * 0.4), 1, 1);
    }
    // lua/sol pixelado
    const mx = Math.floor(lw * 0.72), my = Math.floor(lh * 0.24), mr = Math.floor(lh * 0.08);
    for (let y = -mr - 2; y <= mr + 2; y++) for (let x = -mr - 2; x <= mr + 2; x++) {
      const d = Math.hypot(x, y);
      if (d <= mr) { p.fillStyle = o.moon; p.fillRect(mx + x, my + y, 1, 1); }
      else if (d <= mr + 2 && (x + y) % 2 === 0) { p.fillStyle = rgba(o.moon, 0.4); p.fillRect(mx + x, my + y, 1, 1); }
    }
    // camadas de montanhas
    o.layers.forEach((color, i) => {
      const base = lh * (0.5 + i * 0.1);
      let y = base - rand() * lh * 0.15;
      p.fillStyle = color;
      for (let x = 0; x < lw; x++) {
        y += (rand() - 0.5) * (3 - i * 0.6);
        y = Math.max(base - lh * (0.22 - i * 0.04), Math.min(base + lh * 0.04, y));
        p.fillRect(x, Math.floor(y), 1, lh - Math.floor(y));
      }
    });
    // pinheiros
    const treeBase = Math.floor(lh * 0.86);
    for (let x = 0; x < lw; x += 3 + Math.floor(rand() * 7)) {
      const th = 8 + Math.floor(rand() * 16);
      p.fillStyle = o.trees;
      for (let k = 0; k < th; k++) {
        const half = Math.floor((k / th) * (th / 3)) + 1;
        p.fillRect(x - half, treeBase - th + k, half * 2 + 1, 1);
      }
      p.fillRect(x, treeBase, 1, 2);
    }
    // lago
    p.fillStyle = o.water;
    p.fillRect(0, treeBase + 2, lw, lh);
    for (let i = 0; i < lw * 0.25; i++) {
      p.fillStyle = rgba(o.moon, 0.2 + rand() * 0.5);
      const x = Math.floor(mx + (rand() - 0.5) * lw * 0.2);
      p.fillRect(x, treeBase + 3 + Math.floor(rand() * (lh - treeBase - 3)), 2 + Math.floor(rand() * 5), 1);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, lw * px, lh * px);
    ctx.imageSmoothingEnabled = true;
  };

  /* Espaço: nebulosa, estrelas e planeta com anel. */
  generators.nebula = function (ctx, w, h, o, rand) {
    const U = h / 1080;
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) {
      const t = rand();
      const x = w * (0.05 + t * 0.9) + (rand() - 0.5) * w * 0.22;
      const y = h * (0.85 - t * 0.7) + (rand() - 0.5) * h * 0.3;
      const r = (50 + Math.pow(rand(), 2) * 420) * U;
      const c = o.colors[Math.floor(rand() * o.colors.length)];
      ctx.fillStyle = radial(ctx, x, y, r, [[0, rgba(c, 0.09 + rand() * 0.1)], [1, rgba(c, 0)]]);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    stars(ctx, w, h, rand, 1400, h);
    // estrelas brilhantes com cruz
    for (let i = 0; i < 18; i++) {
      const x = rand() * w, y = rand() * h, l = (10 + rand() * 26) * U;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.2 * U;
      setGlow(ctx, '#ffffff', 10 * U);
      ctx.beginPath(); ctx.moveTo(x - l, y); ctx.lineTo(x + l, y); ctx.moveTo(x, y - l); ctx.lineTo(x, y + l); ctx.stroke();
      noGlow(ctx);
    }
    if (o.planet) {
      const px = w * 0.8, py = h * 0.78, pr = 230 * U;
      const ring = (front) => {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.35);
        ctx.strokeStyle = rgba(o.planet[2], 0.55);
        ctx.lineWidth = 16 * U;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 1.8, pr * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };
      ring(false);
      setGlow(ctx, rgba(o.planet[0], 0.7), 60 * U);
      ctx.fillStyle = radial(ctx, px - pr * 0.4, py - pr * 0.4, pr * 1.7, [[0, o.planet[0]], [0.6, o.planet[1]], [1, '#000000']]);
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      noGlow(ctx);
      ring(true);
    }
    vignette(ctx, w, h, 0.5);
  };

  // ---------- API pública ----------
  function render(canvas, spec, seed) {
    const ctx = canvas.getContext('2d');
    const gen = generators[spec.type];
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gen) gen(ctx, canvas.width, canvas.height, spec, mulberry32(seed == null ? spec.seed || 1 : seed));
    ctx.restore();
    return canvas;
  }

  function renderToDataUrl(spec, width, height, seed, type, quality) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    render(c, spec, seed);
    return c.toDataURL(type || 'image/png', quality);
  }

  window.Wallpapers = { render, renderToDataUrl, mix, rgba };
})();
