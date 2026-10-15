/* MiltonLearn Learning Lab: Mathematics tools */
(function () {
  'use strict';
  const { $, $$, el, svgEl, seg, range, clamp, lerp, ease, fmt, sf3, rand, pick, loop } = Lab;

  const GREEN = '#198754', INK = '#1e293b', MUTED = '#64748b', AMBER = '#f59e0b';

  /* Formats polynomial-style terms: [[coef, 'x²'], [coef, 'x'], [coef, '']] → "x² − 2x + 1" */
  function terms(list) {
    let out = '';
    list.forEach(([c, v]) => {
      if (Math.abs(c) < 1e-12) return;
      const neg = c < 0, a = Math.abs(c);
      const num = v && Math.abs(a - 1) < 1e-12 ? '' : fmt(a, 2);
      const t = num + v;
      out += out ? (neg ? ' − ' : ' + ') + t : (neg ? '−' : '') + t;
    });
    return out || '0';
  }

  /* ======================================================
     Graph explorer
     ====================================================== */
  const FAMILIES = {
    linear: {
      params: [['m', 'Gradient <span class="sym">m</span>', -5, 5, 0.5, 2], ['c', 'y-intercept <span class="sym">c</span>', -10, 10, 1, 1]],
      f: p => x => p.m * x + p.c,
      eq: p => 'y = ' + terms([[p.m, 'x'], [p.c, '']])
    },
    quadratic: {
      params: [['a', '<span class="sym">a</span>', -3, 3, 0.5, 1], ['b', '<span class="sym">b</span>', -6, 6, 1, -2], ['c', '<span class="sym">c</span>', -8, 8, 1, -3]],
      f: p => x => p.a * x * x + p.b * x + p.c,
      eq: p => 'y = ' + terms([[p.a, 'x²'], [p.b, 'x'], [p.c, '']])
    },
    cubic: {
      params: [['a', '<span class="sym">a</span>', -2, 2, 0.25, 0.5], ['b', '<span class="sym">b</span>', -3, 3, 0.5, 0], ['c', '<span class="sym">c</span>', -6, 6, 1, -3], ['d', '<span class="sym">d</span>', -8, 8, 1, 0]],
      f: p => x => ((p.a * x + p.b) * x + p.c) * x + p.d,
      eq: p => 'y = ' + terms([[p.a, 'x³'], [p.b, 'x²'], [p.c, 'x'], [p.d, '']])
    },
    reciprocal: {
      params: [['k', '<span class="sym">k</span>', -10, 10, 1, 4]],
      f: p => x => p.k / x,
      eq: p => (p.k === 0 ? 'y = 0' : `y = ${p.k < 0 ? '−' : ''}${fmt(Math.abs(p.k), 2)} / x`)
    },
    exponential: {
      params: [['a', '<span class="sym">a</span>', 0.5, 5, 0.5, 1], ['b', '<span class="sym">b</span>', 0.25, 3, 0.25, 2]],
      f: p => x => p.a * Math.pow(p.b, x),
      eq: p => `y = ${p.a === 1 ? '' : fmt(p.a, 2) + ' × '}${fmt(p.b, 2)}<sup>x</sup>`
    }
  };
  const PIN_COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b'];

  function findRoots(f, lo, hi) {
    const roots = [];
    const N = 2000;
    let px = lo, py = f(lo);
    for (let i = 1; i <= N; i++) {
      const x = lo + (hi - lo) * i / N, y = f(x);
      if (!isFinite(y) || !isFinite(py) || Math.abs(y) > 1e6 || Math.abs(py) > 1e6) { px = x; py = y; continue; }
      if (py === 0) roots.push(px);
      else if (py * y < 0) {
        let a = px, b = x;
        for (let k = 0; k < 50; k++) { const m = (a + b) / 2; (f(a) * f(m) <= 0) ? (b = m) : (a = m); }
        roots.push((a + b) / 2);
      }
      px = x; py = y;
    }
    return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > 1e-6);
  }

  Lab.register('math-graphs', {
    init() {
      const cvEl = $('#gr-canvas');
      const cv = Lab.canvas(cvEl, 0.78, () => draw());
      const paramsBox = $('#gr-params');
      let R = 10, p = {}, pins = [], hover = null, family = 'linear';

      const type = seg($('#gr-type'), v => { family = v; buildParams(); });

      function buildParams() {
        paramsBox.innerHTML = '';
        p = {};
        FAMILIES[family].params.forEach(([key, label, min, max, step, def]) => {
          const g = el('div', { class: 'ctrl-group' }, paramsBox);
          const lab = el('label', { class: 'ctrl-label', html: `${label} <span class="val"></span>` }, g);
          const input = el('input', { type: 'range', class: 'lab-range', min, max, step, value: def, 'aria-label': key }, g);
          p[key] = def;
          range(input, $('.val', lab), v => fmt(v, 2), v => { p[key] = v; render(); });
        });
        render();
      }

      function features() {
        const F = FAMILIES[family], f = F.f(p);
        const pt = (x, y) => `(${fmt(x, 2)}, ${fmt(y, 2)})`;
        const items = [], points = [];
        if (family === 'linear') {
          items.push(`Gradient = <strong>${fmt(p.m, 2)}</strong> ${p.m > 0 ? '(slopes up ↗)' : p.m < 0 ? '(slopes down ↘)' : '(horizontal line)'}`);
          items.push(`Crosses the y-axis at <strong>${pt(0, p.c)}</strong>`);
          points.push([0, p.c]);
          if (p.m !== 0) { items.push(`Crosses the x-axis at <strong>${pt(-p.c / p.m, 0)}</strong>`); points.push([-p.c / p.m, 0]); }
          items.push('<span class="text-muted">Parallel lines have the same gradient.</span>');
        } else if (family === 'quadratic') {
          if (p.a === 0) items.push('a = 0, so this is not a quadratic any more; it is a straight line!');
          else {
            const vx = -p.b / (2 * p.a), vy = f(vx), D = p.b * p.b - 4 * p.a * p.c;
            items.push(`${p.a > 0 ? '∪ shape with a <strong>minimum</strong>' : '∩ shape with a <strong>maximum</strong>'} turning point at <strong>${pt(vx, vy)}</strong>`);
            items.push(`Line of symmetry: <strong>x = ${fmt(vx, 2)}</strong>`);
            points.push([vx, vy]);
            if (D > 1e-12) {
              const r1 = (-p.b - Math.sqrt(D)) / (2 * p.a), r2 = (-p.b + Math.sqrt(D)) / (2 * p.a);
              items.push(`Two roots: <strong>x = ${fmt(Math.min(r1, r2), 2)}</strong> and <strong>x = ${fmt(Math.max(r1, r2), 2)}</strong>`);
              points.push([r1, 0], [r2, 0]);
            } else if (Math.abs(D) <= 1e-12) { items.push(`One repeated root: <strong>x = ${fmt(vx, 2)}</strong> (touches the x-axis)`); }
            else items.push('No real roots: the curve never crosses the x-axis');
            items.push(`<span class="text-muted">Discriminant b² − 4ac = ${fmt(D, 2)}</span>`);
          }
          items.push(`y-intercept: <strong>${pt(0, p.c)}</strong>`);
          points.push([0, p.c]);
        } else if (family === 'cubic') {
          const roots = findRoots(f, -R * 1.5, R * 1.5);
          items.push(roots.length ? `Roots: <strong>${roots.map(r => 'x = ' + fmt(r, 2)).join(', ')}</strong>` : 'No roots in view');
          roots.forEach(r => points.push([r, 0]));
          const A = 3 * p.a, B = 2 * p.b, C = p.c, D = B * B - 4 * A * C;
          if (A !== 0 && D > 0) {
            const t = [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)];
            items.push(`Turning points: <strong>${t.map(x => pt(x, f(x))).join(' and ')}</strong>`);
            t.forEach(x => points.push([x, f(x)]));
          } else if (p.a !== 0) items.push('No turning points: the curve keeps going in one direction');
          items.push(`y-intercept: <strong>${pt(0, p.d)}</strong>`);
          points.push([0, p.d]);
        } else if (family === 'reciprocal') {
          items.push('Asymptotes: <strong>x = 0</strong> and <strong>y = 0</strong>. The curve gets closer to the axes but never touches them.');
          items.push(p.k > 0 ? 'k &gt; 0: branches in the 1st and 3rd quadrants' : p.k < 0 ? 'k &lt; 0: branches in the 2nd and 4th quadrants' : 'k = 0 gives the line y = 0');
          if (p.k !== 0) { const s = Math.sqrt(Math.abs(p.k)); points.push([s, f(s)], [-s, f(-s)]); }
        } else {
          items.push(`y-intercept: <strong>${pt(0, p.a)}</strong> (because b<sup>0</sup> = 1)`);
          items.push(p.b > 1 ? '<strong>Exponential growth</strong> (b &gt; 1)' : p.b < 1 ? '<strong>Exponential decay</strong> (0 &lt; b &lt; 1)' : 'b = 1: a horizontal line');
          items.push('Asymptote: <strong>y = 0</strong>. The curve never reaches the x-axis.');
          points.push([0, p.a]);
        }
        return { items, points };
      }

      function render() {
        $('#gr-eq').innerHTML = FAMILIES[family].eq(p);
        const { items } = features();
        $('#gr-features').innerHTML = items.map(i => `<div class="mb-1">${i}</div>`).join('');
        draw();
      }

      function plotFn(ctx, f, X, Y, yR, color, width, dash) {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
        ctx.beginPath();
        let pen = false, prev = null;
        const W = cv.w;
        for (let px = 0; px <= W; px += 1) {
          const x = (px / W) * 2 * R - R;
          const y = f(x);
          const bad = !isFinite(y) || Math.abs(y) > yR * 6 || (prev !== null && Math.sign(y) !== Math.sign(prev) && Math.abs(y - prev) > yR * 2);
          if (bad) { pen = false; prev = isFinite(y) ? y : null; continue; }
          if (!pen) { ctx.moveTo(X(x), Y(y)); pen = true; } else ctx.lineTo(X(x), Y(y));
          prev = y;
        }
        ctx.stroke(); ctx.setLineDash([]);
      }

      function draw() {
        const { ctx, w, h } = cv;
        if (!w) return;
        const yR = R * h / w;
        const X = x => (x + R) / (2 * R) * w, Y = y => h / 2 - y / yR * (h / 2);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        const step = R <= 5 ? 1 : R <= 10 ? 1 : 2;
        const labelStep = R <= 5 ? 1 : R <= 10 ? 2 : 5;
        ctx.lineWidth = 1;
        for (let x = -Math.floor(R / step) * step; x <= R; x += step) {
          ctx.strokeStyle = x % (labelStep) === 0 ? '#e2e8f0' : '#f1f5f9';
          ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), h); ctx.stroke();
        }
        for (let y = -Math.floor(yR / step) * step; y <= yR; y += step) {
          ctx.strokeStyle = y % (labelStep) === 0 ? '#e2e8f0' : '#f1f5f9';
          ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke();
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), h); ctx.stroke();
        ctx.fillStyle = MUTED; ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        for (let x = -Math.floor(R / labelStep) * labelStep; x <= R; x += labelStep) if (x && Math.abs(x) < R) ctx.fillText(x, X(x), Y(0) + 13);
        ctx.textAlign = 'right';
        for (let y = -Math.floor(yR / labelStep) * labelStep; y <= yR; y += labelStep) if (y) ctx.fillText(y, X(0) - 4, Y(y) + 3);
        ctx.fillStyle = INK; ctx.font = '700 12px Inter, sans-serif';
        ctx.fillText('x', w - 6, Y(0) - 6);
        ctx.textAlign = 'left'; ctx.fillText('y', X(0) + 6, 12);

        if (family === 'reciprocal') {
          ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(220,53,69,0.5)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), h); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke();
          ctx.setLineDash([]);
        }
        pins.forEach(pin => {
          plotFn(ctx, pin.f, X, Y, yR, pin.color, 2.2, [7, 5]);
        });
        const f = FAMILIES[family].f(p);
        plotFn(ctx, f, X, Y, yR, GREEN, 3.2);

        const { points } = features();
        points.forEach(([x, y]) => {
          if (Math.abs(x) > R || Math.abs(y) > yR) return;
          ctx.fillStyle = '#fff'; ctx.strokeStyle = GREEN; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });

        if (hover !== null) {
          const y = f(hover);
          if (isFinite(y) && Math.abs(y) < yR) {
            ctx.strokeStyle = 'rgba(245,158,11,0.6)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(X(hover), Y(0)); ctx.lineTo(X(hover), Y(y)); ctx.lineTo(X(0), Y(y)); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(X(hover), Y(y), 6, 0, Math.PI * 2); ctx.fill();
            const label = `(${fmt(hover, 2)}, ${fmt(y, 2)})`;
            ctx.font = '700 12px JetBrains Mono, monospace';
            const tw = ctx.measureText(label).width + 14;
            const bx = clamp(X(hover) + 10, 4, w - tw - 4), by = clamp(Y(y) - 30, 4, h - 26);
            ctx.fillStyle = INK; ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(bx, by, tw, 22, 6) : ctx.rect(bx, by, tw, 22); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(label, bx + 7, by + 15);
          }
        }
        if (pins.length) {
          ctx.font = '700 11px Inter, sans-serif'; ctx.textAlign = 'left';
          pins.forEach((pin, i) => { ctx.fillStyle = pin.color; ctx.fillText('- - ' + pin.label.replace(/<\/?sup>/g, ''), 8, h - 10 - i * 15); });
        }
      }

      function hoverAt(clientX) {
        const r = cvEl.getBoundingClientRect();
        hover = ((clientX - r.left) / r.width) * 2 * R - R;
        hover = Math.round(hover * 10) / 10;
        draw();
      }
      cvEl.addEventListener('mousemove', e => hoverAt(e.clientX));
      cvEl.addEventListener('touchmove', e => { if (e.touches[0]) hoverAt(e.touches[0].clientX); }, { passive: true });
      cvEl.addEventListener('mouseleave', () => { hover = null; draw(); });

      $('#gr-pin').addEventListener('click', () => {
        if (pins.length >= 4) pins.shift();
        pins.push({ f: FAMILIES[family].f({ ...p }), label: FAMILIES[family].eq(p), color: PIN_COLORS[pins.length % PIN_COLORS.length] });
        draw();
      });
      $('#gr-clear').addEventListener('click', () => { pins = []; draw(); });
      $('#gr-zoom-in').addEventListener('click', () => { R = Math.max(5, R / 2); render(); });
      $('#gr-zoom-out').addEventListener('click', () => { R = Math.min(20, R * 2); render(); });
      buildParams();
      this._draw = draw;
    },
    start() { this._draw && this._draw(); }
  });

  /* ======================================================
     Trigonometry
     ====================================================== */
  Lab.register('math-trig', {
    init() {
      const svg = $('#tr-svg');
      const angle = range($('#tr-angle'), $('#tr-angle-val'), v => `${v}°`, () => draw());
      const hyp = range($('#tr-hyp'), $('#tr-hyp-val'), v => `${v} cm`, () => draw());
      const focus = seg($('#tr-focus'), () => draw());
      const COL = { O: '#d97706', A: '#0ea5e9', H: GREEN };
      const rad = d => d * Math.PI / 180;

      function draw() {
        const th = angle.value, H = hyp.value;
        const O = H * Math.sin(rad(th)), Ad = H * Math.cos(rad(th));
        const S = 22, Ax = 70, Ay = 300;
        const Bx = Ax + Ad * S, By = Ay, Cx = Bx, Cy = Ay - O * S;
        const uses = { sin: ['O', 'H'], cos: ['A', 'H'], tan: ['O', 'A'] }[focus.value];
        svg.innerHTML = '';
        svgEl('polygon', { points: `${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}`, fill: 'rgba(32,201,151,0.1)' }, svg);
        const side = (x1, y1, x2, y2, k) => svgEl('line', { x1, y1, x2, y2, stroke: COL[k], 'stroke-width': uses.includes(k) ? 6 : 3, 'stroke-linecap': 'round', opacity: uses.includes(k) ? 1 : 0.4 }, svg);
        side(Ax, Ay, Bx, By, 'A');
        side(Bx, By, Cx, Cy, 'O');
        side(Ax, Ay, Cx, Cy, 'H');
        const sq = 14;
        svgEl('path', { d: `M${Bx - sq} ${By} V${By - sq} H${Bx}`, fill: 'none', stroke: INK, 'stroke-width': 1.6 }, svg);
        const ar = 40;
        svgEl('path', { d: `M${Ax + ar} ${Ay} A${ar} ${ar} 0 0 0 ${Ax + ar * Math.cos(rad(th))} ${Ay - ar * Math.sin(rad(th))}`, fill: 'rgba(245,158,11,0.25)', stroke: AMBER, 'stroke-width': 2 }, svg);
        svgEl('text', { x: Ax + (ar + 14) * Math.cos(rad(th / 2)), y: Ay - (ar + 14) * Math.sin(rad(th / 2)) + 5, text: 'θ', 'font-size': 16, 'font-weight': 800, fill: '#b45309', 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' }, svg);
        const lab = (x, y, t, k, anchor = 'middle') => svgEl('text', { x, y, text: t, 'font-size': 13, 'font-weight': 800, fill: COL[k], 'text-anchor': anchor, 'font-family': 'Inter, sans-serif', opacity: uses.includes(k) ? 1 : 0.6 }, svg);
        lab((Ax + Bx) / 2, Ay + 20, `Adjacent = ${fmt(Ad, 2)}`, 'A');
        lab(Bx + 10, (By + Cy) / 2 + 4, `Opposite = ${fmt(O, 2)}`, 'O', 'start');
        const mx = (Ax + Cx) / 2, my = (Ay + Cy) / 2, len = Math.hypot(Cx - Ax, Cy - Ay);
        const nx = -(Cy - Ay) / len, ny = (Cx - Ax) / len;
        svgEl('text', { x: mx - nx * 16, y: my - ny * 16, text: `Hypotenuse = ${fmt(H, 2)}`, 'font-size': 13, 'font-weight': 800, fill: COL.H, 'text-anchor': 'middle', transform: `rotate(${-th} ${mx - nx * 16} ${my - ny * 16})`, 'font-family': 'Inter, sans-serif', opacity: uses.includes('H') ? 1 : 0.6 }, svg);
        svgEl('text', { x: 510, y: 30, text: `${fmt(O, 2)}² + ${fmt(Ad, 2)}² = ${fmt(O * O + Ad * Ad, 2)} = ${fmt(H, 2)}²`, 'font-size': 12, 'font-weight': 700, fill: MUTED, 'text-anchor': 'end', 'font-family': 'JetBrains Mono, monospace' }, svg);
        svgEl('text', { x: 510, y: 48, text: 'Pythagoras: O² + A² = H²', 'font-size': 11, fill: MUTED, 'text-anchor': 'end', 'font-family': 'Inter, sans-serif' }, svg);

        const line = (k, name, a, b, va, vb) => `<div class="ratio-line ${focus.value === k ? 'hl' : ''}"><b>${name}</b><span>${a}/${b} = ${fmt(va, 2)}/${fmt(vb, 2)} = <strong>${Number((va / vb).toFixed(3))}</strong></span></div>`;
        $('#tr-ratios').innerHTML =
          line('sin', `sin ${th}°`, 'O', 'H', O, H) +
          line('cos', `cos ${th}°`, 'A', 'H', Ad, H) +
          line('tan', `tan ${th}°`, 'O', 'A', O, Ad);
      }

      /* practice */
      let q = null;
      const fb = $('#tr-fb');
      function newQ() {
        const th = rand(15, 75), side = rand(30, 140) / 10;
        const r = rad(th);
        const kinds = [
          { text: `The angle is ${th}° and the hypotenuse is ${side} cm. Find the <strong>opposite</strong> side.`, ans: side * Math.sin(r), work: `sin ${th}° = x / ${side} → x = ${side} × sin ${th}°` },
          { text: `The angle is ${th}° and the hypotenuse is ${side} cm. Find the <strong>adjacent</strong> side.`, ans: side * Math.cos(r), work: `cos ${th}° = x / ${side} → x = ${side} × cos ${th}°` },
          { text: `The angle is ${th}° and the adjacent side is ${side} cm. Find the <strong>opposite</strong> side.`, ans: side * Math.tan(r), work: `tan ${th}° = x / ${side} → x = ${side} × tan ${th}°` },
          { text: `The angle is ${th}° and the opposite side is ${side} cm. Find the <strong>hypotenuse</strong>.`, ans: side / Math.sin(r), work: `sin ${th}° = ${side} / x → x = ${side} ÷ sin ${th}°` }
        ];
        const o = rand(20, 90) / 10, h = +(o + rand(5, 60) / 10).toFixed(1);
        kinds.push({ text: `The opposite side is ${o} cm and the hypotenuse is ${h} cm. Find the <strong>angle θ</strong> (1 d.p.).`, ans: Math.asin(o / h) * 180 / Math.PI, work: `sin θ = ${o} / ${h} → θ = sin⁻¹(${o} ÷ ${h})`, angle: true });
        q = pick(kinds);
        $('#tr-q').innerHTML = q.text;
        $('#tr-ans').value = '';
        fb.textContent = '';
        fb.className = 'feedback mt-2';
      }
      function check() {
        const v = parseFloat($('#tr-ans').value);
        if (isNaN(v)) { fb.className = 'feedback mt-2 bad'; fb.textContent = 'Type a number first.'; return; }
        const correct = q.angle ? Number(q.ans.toFixed(1)) : Number(sf3(q.ans));
        const ok = q.angle ? Math.abs(v - q.ans) <= 0.06 : Math.abs(v - q.ans) <= Math.abs(q.ans) * 0.006 + 1e-9;
        fb.className = 'feedback mt-2 ' + (ok ? 'ok' : 'bad');
        fb.innerHTML = (ok ? '✔ Correct! ' : `✘ The answer is ${correct}${q.angle ? '°' : ' cm'}. `) + `<span class="text-muted fw-normal">${q.work} = ${correct}</span>`;
        if (ok) setTimeout(newQ, 2200);
      }
      $('#tr-check').addEventListener('click', check);
      $('#tr-ans').addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
      $('#tr-new').addEventListener('click', newQ);
      newQ();
      draw();
    }
  });

  /* ======================================================
     Transformations
     ====================================================== */
  const SHAPES = {
    tri: [[1, 1], [4, 1], [1, 3]],
    flag: [[1, 1], [2, 1], [2, 3], [4, 4], [2, 5], [1, 5]],
    L: [[1, 1], [4, 1], [4, 2], [2, 2], [2, 4], [1, 4]]
  };

  Lab.register('math-transform', {
    init() {
      const svg = $('#tf-svg');
      const box = $('#tf-params');
      const U = 22, O = 200;
      const X = x => O + x * U, Y = y => O - y * U;
      let P = {}, t = 1, animating = false;

      const type = seg($('#tf-type'), () => { buildParams(); });
      const shape = seg($('#tf-shape'), () => { t = 1; draw(); });

      function slider(key, label, min, max, step, def) {
        const g = el('div', { class: 'ctrl-group' }, box);
        const lab = el('label', { class: 'ctrl-label', html: `${label} <span class="val"></span>` }, g);
        const input = el('input', { type: 'range', class: 'lab-range', min, max, step, value: def, 'aria-label': key }, g);
        P[key] = def;
        range(input, $('.val', lab), v => v, v => { P[key] = v; t = 1; draw(); });
      }
      function choice(key, label, options, def) {
        const g = el('div', { class: 'ctrl-group' }, box);
        el('span', { class: 'ctrl-label', text: label }, g);
        const s = el('div', { class: 'seg' }, g);
        options.forEach(([v, txt]) => el('button', { 'data-v': v, class: v === def ? 'active' : '', html: txt }, s));
        P[key] = def;
        seg(s, v => { P[key] = v; t = 1; buildParams(true); });
      }

      function buildParams(keep) {
        const old = keep ? { ...P } : {};
        box.innerHTML = '';
        P = {};
        const v = (k, d) => (k in old ? old[k] : d);
        if (type.value === 'translate') {
          slider('a', 'Move right (<span class="sym">a</span>)', -6, 6, 1, v('a', 3));
          slider('b', 'Move up (<span class="sym">b</span>)', -6, 6, 1, v('b', -4));
        } else if (type.value === 'reflect') {
          choice('line', 'Mirror line', [['y0', 'x-axis'], ['x0', 'y-axis'], ['yx', 'y = x'], ['ynx', 'y = −x'], ['xk', 'x = k'], ['yk', 'y = k']], v('line', 'y0'));
          if (P.line === 'xk' || P.line === 'yk') slider('k', '<span class="sym">k</span>', -4, 4, 1, v('k', -1));
        } else if (type.value === 'rotate') {
          choice('ang', 'Angle', [['-90', '90° clockwise'], ['90', '90° anticlockwise'], ['180', '180°']], v('ang', '-90'));
          slider('cx', 'Centre x', -4, 4, 1, v('cx', 0));
          slider('cy', 'Centre y', -4, 4, 1, v('cy', 0));
        } else {
          choice('k', 'Scale factor', [['2', '2'], ['3', '3'], ['0.5', '½'], ['-1', '−1'], ['-2', '−2']], v('k', '2'));
          slider('cx', 'Centre x', -4, 4, 1, v('cx', 0));
          slider('cy', 'Centre y', -4, 4, 1, v('cy', 0));
        }
        t = 1;
        draw();
      }

      /* Returns the image of point (x, y) part-way (s from 0 to 1) through the transformation. */
      function mapPoint([x, y], s) {
        const ty = type.value;
        if (ty === 'translate') return [x + P.a * s, y + P.b * s];
        if (ty === 'reflect') {
          let img;
          switch (P.line) {
            case 'y0': img = [x, -y]; break;
            case 'x0': img = [-x, y]; break;
            case 'yx': img = [y, x]; break;
            case 'ynx': img = [-y, -x]; break;
            case 'xk': img = [2 * P.k - x, y]; break;
            default: img = [x, 2 * P.k - y];
          }
          return [lerp(x, img[0], s), lerp(y, img[1], s)];
        }
        if (ty === 'rotate') {
          const a = Number(P.ang) * Math.PI / 180 * s;
          const dx = x - P.cx, dy = y - P.cy;
          return [P.cx + dx * Math.cos(a) - dy * Math.sin(a), P.cy + dx * Math.sin(a) + dy * Math.cos(a)];
        }
        const k = lerp(1, Number(P.k), s);
        return [P.cx + (x - P.cx) * k, P.cy + (y - P.cy) * k];
      }

      function describe() {
        const ty = type.value;
        if (ty === 'translate') return `Translation by vector <span style="display:inline-flex;flex-direction:column;align-items:center;line-height:1.15;vertical-align:middle;border-left:2px solid;border-right:2px solid;border-radius:8px;padding:0 7px;margin:0 2px">${P.a}<span>${P.b}</span></span>`;
        if (ty === 'reflect') {
          const L = { y0: 'the x-axis (y = 0)', x0: 'the y-axis (x = 0)', yx: 'the line y = x', ynx: 'the line y = −x', xk: `the line x = ${P.k}`, yk: `the line y = ${P.k}` }[P.line];
          return `Reflection in ${L}`;
        }
        if (ty === 'rotate') return `Rotation, ${P.ang === '180' ? '180°' : P.ang === '90' ? '90° anticlockwise' : '90° clockwise'}, centre (${P.cx}, ${P.cy})`;
        const kTxt = { '0.5': '½', '-1': '−1', '-2': '−2' }[P.k] || P.k;
        return `Enlargement, scale factor ${kTxt}, centre (${P.cx}, ${P.cy})`;
      }

      function draw() {
        svg.innerHTML = '';
        const defs = svgEl('defs', {}, svg);
        const clip = svgEl('clipPath', { id: 'tf-clip' }, defs);
        svgEl('rect', { x: 0, y: 0, width: 400, height: 400 }, clip);
        const grid = svgEl('g', {}, svg);
        for (let i = -9; i <= 9; i++) {
          svgEl('line', { x1: X(i), y1: 0, x2: X(i), y2: 400, stroke: i === 0 ? INK : '#e2e8f0', 'stroke-width': i === 0 ? 1.8 : 1 }, grid);
          svgEl('line', { x1: 0, y1: Y(i), x2: 400, y2: Y(i), stroke: i === 0 ? INK : '#e2e8f0', 'stroke-width': i === 0 ? 1.8 : 1 }, grid);
          if (i && i % 2 === 0 && Math.abs(i) < 9) {
            svgEl('text', { x: X(i), y: Y(0) + 13, text: i, 'font-size': 9, fill: MUTED, 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' }, grid);
            svgEl('text', { x: X(0) - 4, y: Y(i) + 3, text: i, 'font-size': 9, fill: MUTED, 'text-anchor': 'end', 'font-family': 'Inter, sans-serif' }, grid);
          }
        }
        const g = svgEl('g', { 'clip-path': 'url(#tf-clip)' }, svg);
        const pts = SHAPES[shape.value];
        const img = pts.map(p => mapPoint(p, 1));
        const ty = type.value;

        // construction guides
        if (ty === 'reflect') {
          const big = 20;
          const seg2 = { y0: [-big, 0, big, 0], x0: [0, -big, 0, big], yx: [-big, -big, big, big], ynx: [-big, big, big, -big], xk: [P.k, -big, P.k, big], yk: [-big, P.k, big, P.k] }[P.line];
          svgEl('line', { x1: X(seg2[0]), y1: Y(seg2[1]), x2: X(seg2[2]), y2: Y(seg2[3]), stroke: '#dc3545', 'stroke-width': 2.5, 'stroke-dasharray': '8 5' }, g);
        }
        if (ty === 'rotate' || ty === 'enlarge') {
          if (ty === 'enlarge') img.forEach((q) => svgEl('line', { x1: X(P.cx), y1: Y(P.cy), x2: X(q[0]), y2: Y(q[1]), stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '4 4' }, g));
          svgEl('circle', { cx: X(P.cx), cy: Y(P.cy), r: 5, fill: '#dc3545' }, g);
        }
        if (ty === 'translate') {
          const [x0, y0] = pts[0];
          svgEl('line', { x1: X(x0), y1: Y(y0), x2: X(x0 + P.a), y2: Y(y0 + P.b), stroke: '#dc3545', 'stroke-width': 2, 'stroke-dasharray': '6 4', 'marker-end': 'url(#tf-arrow)' }, g);
          const m = svgEl('marker', { id: 'tf-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
          svgEl('path', { d: 'M0 0 L10 5 L0 10 Z', fill: '#dc3545' }, m);
        }

        const poly = (ps, attrs) => svgEl('polygon', { points: ps.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), ...attrs }, g);
        poly(pts, { fill: 'rgba(25,135,84,0.35)', stroke: GREEN, 'stroke-width': 2.5 });
        if (t >= 1) poly(img, { fill: 'rgba(245,158,11,0.35)', stroke: '#d97706', 'stroke-width': 2.5 });
        else {
          const mid = pts.map(p => mapPoint(p, ease(t)));
          poly(img, { fill: 'none', stroke: '#d97706', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', opacity: 0.6 });
          poly(mid, { fill: 'rgba(245,158,11,0.3)', stroke: '#d97706', 'stroke-width': 2.5 });
        }
        const centroid = ps => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];
        const [ax, ay] = centroid(pts), [bx, by] = centroid(img);
        svgEl('text', { x: X(ax), y: Y(ay) + 5, text: 'A', 'font-size': 15, 'font-weight': 800, fill: '#157347', 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' }, g);
        if (t >= 1) svgEl('text', { x: X(bx), y: Y(by) + 5, text: 'A′', 'font-size': 15, 'font-weight': 800, fill: '#b45309', 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' }, g);

        $('#tf-desc').innerHTML = describe();
        const c = ([x, y]) => `(${fmt(x, 2)}, ${fmt(y, 2)})`;
        $('#tf-coords').innerHTML = '<thead><tr><th>Object A</th><th></th><th>Image A′</th></tr></thead><tbody>' +
          pts.map((p, i) => `<tr><td>${c(p)}</td><td>→</td><td>${c(img[i])}</td></tr>`).join('') + '</tbody>';
      }

      const anim = loop(dt => {
        if (!animating) return;
        t = Math.min(1, t + dt / 1.4);
        if (t >= 1) { animating = false; anim.stop(); }
        draw();
      });
      $('#tf-apply').addEventListener('click', () => { t = 0; animating = true; anim.start(); });
      buildParams();
      this._stop = () => { animating = false; anim.stop(); t = 1; draw(); };
    },
    stop() { this._stop && this._stop(); }
  });

  /* ======================================================
     Probability
     ====================================================== */
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const frac = (n, d) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
  const EXPERIMENTS = {
    coin: { outcomes: ['H', 'T'], p: () => [1, 2], roll: () => [pick(['H', 'T'])], key: r => r[0], names: { H: 'Heads', T: 'Tails' } },
    die: { outcomes: [1, 2, 3, 4, 5, 6], p: () => [1, 6], roll: () => [rand(1, 6)], key: r => r[0] },
    two: { outcomes: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], p: s => [6 - Math.abs(s - 7), 36], roll: () => [rand(1, 6), rand(1, 6)], key: r => r[0] + r[1] }
  };
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  Lab.register('math-prob', {
    init(panel) {
      let exp = 'coin', counts = {}, trials = 0, last = null;
      const show = $('#pr-show'), bars = $('#pr-bars');
      const E = () => EXPERIMENTS[exp];

      function reset() {
        counts = {}; trials = 0; last = null;
        E().outcomes.forEach(o => { counts[o] = 0; });
        bars.innerHTML = '';
        E().outcomes.forEach(o => {
          const col = el('div', { class: 'prob-col' }, bars);
          el('span', { class: 'pct' }, col);
          el('div', { class: 'prob-bar', style: 'height:0' }, col);
          el('div', { class: 'prob-theory' }, col);
          el('span', { class: 'lbl', text: o }, col);
        });
        render();
      }

      function face(r) {
        if (exp === 'coin') return `<div class="coin roll">${r[0]}</div>`;
        return r.map(v => `<div class="die roll">${[...Array(9)].map((_, i) => `<i class="${PIPS[v].includes(i) ? 'p' : ''}"></i>`).join('')}</div>`).join('');
      }

      function render() {
        const ex = E();
        const probs = ex.outcomes.map(o => { const [n, d] = ex.p(o); return n / d; });
        const rels = ex.outcomes.map(o => (trials ? counts[o] / trials : 0));
        const scale = Math.max(Math.max(...probs) * 1.7, Math.max(...rels) / 0.85, 0.01);
        $$('.prob-col', bars).forEach((col, i) => {
          $('.prob-bar', col).style.height = (rels[i] / scale * 100) + '%';
          $('.prob-theory', col).style.bottom = `calc(${probs[i] / scale * 100}% + 1.3rem)`;
          const pct = $('.pct', col);
          pct.textContent = trials ? rels[i].toFixed(2) : '';
          pct.style.bottom = `calc(${rels[i] / scale * 100}% + 1.3rem)`;
        });
        $('#pr-trials').textContent = trials.toLocaleString();
        show.innerHTML = last ? face(last) : `<span class="text-muted small">Press a button to ${exp === 'coin' ? 'flip the coin' : 'roll'}</span>`;
        $('#pr-table').innerHTML = '<thead><tr><th>Outcome</th><th>Freq.</th><th>Rel. freq.</th><th>Theory</th></tr></thead><tbody>' +
          ex.outcomes.map((o, i) => {
            const [n, d] = ex.p(o);
            return `<tr><td>${ex.names ? ex.names[o] : o}</td><td>${counts[o]}</td><td>${trials ? rels[i].toFixed(3) : '—'}</td><td>${frac(n, d)} = ${(n / d).toFixed(3)}</td></tr>`;
          }).join('') + '</tbody>';
      }

      function run(n) {
        const ex = E();
        for (let i = 0; i < n; i++) {
          const r = ex.roll();
          counts[ex.key(r)]++;
          last = r;
        }
        trials += n;
        render();
      }

      seg($('#pr-exp'), v => { exp = v; reset(); });
      $$('[data-n]', panel).forEach(b => b.addEventListener('click', () => run(Number(b.dataset.n))));
      $('#pr-reset').addEventListener('click', reset);
      reset();
    }
  });
})();
