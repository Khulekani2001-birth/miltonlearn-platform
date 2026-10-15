/* MiltonLearn Learning Lab: Physics tools */
(function () {
  'use strict';
  const { $, svgEl, seg, range, clamp, lerp, fmt, loop } = Lab;

  const GREEN = '#198754', TEAL = '#20c997', INK = '#1e293b', MUTED = '#64748b', GRID = '#e2e8f0';

  function niceMax(x) {
    if (x <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x) return m * p;
    return 10 * p;
  }

  /* Axes helper for small physics graphs. Returns a mapper from data to pixels. */
  function axes(ctx, w, h, xMax, yMax, xLabel, yLabel) {
    const L = 42, R = 10, T = 22, B = 30;
    const X = x => L + (x / xMax) * (w - L - R);
    const Y = y => h - B - (y / yMax) * (h - T - B);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const yv = yMax * i / 5, xv = xMax * i / 5;
      ctx.beginPath(); ctx.moveTo(L, Y(yv)); ctx.lineTo(w - R, Y(yv)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(xv), T); ctx.lineTo(X(xv), h - B); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(fmt(yv, 1), L - 5, Y(yv) + 3);
      ctx.textAlign = 'center'; ctx.fillText(fmt(xv, 1), X(xv), h - B + 13);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, h - B); ctx.lineTo(w - R, h - B); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '700 10px Inter, sans-serif';
    ctx.textAlign = 'right'; ctx.fillText(xLabel, w - R, h - 4);
    ctx.textAlign = 'left'; ctx.fillText(yLabel, 4, 11);
    return { X, Y };
  }

  /* ======================================================
     Motion graphs
     ====================================================== */
  Lab.register('phy-motion', {
    init() {
      const T_END = 10;
      let t = 0, playing = false;
      const playBtn = $('#mo-play');
      const road = Lab.canvas($('#mo-road'), 0.2, () => draw());
      const dtc = Lab.canvas($('#mo-dt'), 0.72, () => draw());
      const vtc = Lab.canvas($('#mo-vt'), 0.72, () => draw());

      const uCtl = range($('#mo-u'), $('#mo-u-val'), v => `${v} m/s`, () => { preset.set('custom', false); reset(); });
      const aCtl = range($('#mo-a'), $('#mo-a-val'), v => `${v} m/s²`, () => { preset.set('custom', false); reset(); });
      const PRESETS = { const: [10, 0], accel: [0, 2], brake: [20, -3] };
      const preset = seg($('#mo-preset'), v => {
        if (PRESETS[v]) { uCtl.set(PRESETS[v][0]); aCtl.set(PRESETS[v][1]); }
        reset();
      });

      const u = () => uCtl.value, a = () => aCtl.value;
      const tStop = () => (a() < 0 ? u() / -a() : Infinity);
      const vel = tt => Math.max(0, u() + a() * Math.min(tt, tStop()));
      const dist = tt => { const te = Math.min(tt, tStop()); return u() * te + 0.5 * a() * te * te; };

      function note() {
        const total = dist(T_END);
        let txt;
        if (a() === 0 && u() === 0) txt = 'The car is <strong>stationary</strong>: a horizontal line at zero on both graphs.';
        else if (a() === 0) txt = '<strong>Constant speed:</strong> a straight sloping line on the distance–time graph and a horizontal line on the speed–time graph.';
        else if (a() > 0) txt = '<strong>Accelerating:</strong> the distance–time curve gets steeper; the speed–time graph is a straight line sloping up with gradient = acceleration.';
        else txt = `<strong>Decelerating:</strong> the distance–time curve levels off; the speed–time line slopes down${isFinite(tStop()) && tStop() < T_END ? ` and reaches zero at t = ${fmt(tStop(), 1)} s, when the car stops` : ''}.`;
        $('#mo-note').innerHTML = `${txt}<br><span class="text-muted">Distance after 10 s = area under speed–time graph = <strong>${fmt(total, 1)} m</strong></span>`;
      }

      function plot(c, f, yMax, xLabel, yLabel, shade) {
        const { ctx, w, h } = c;
        const { X, Y } = axes(ctx, w, h, T_END, yMax, xLabel, yLabel);
        const N = 120;
        // faint full prediction
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(100,116,139,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const tt = T_END * i / N; i ? ctx.lineTo(X(tt), Y(f(tt))) : ctx.moveTo(X(tt), Y(f(tt))); }
        ctx.stroke(); ctx.setLineDash([]);
        if (t <= 0) return;
        const steps = Math.max(2, Math.round(N * t / T_END));
        if (shade) {
          ctx.fillStyle = 'rgba(32,201,151,0.22)';
          ctx.beginPath(); ctx.moveTo(X(0), Y(0));
          for (let i = 0; i <= steps; i++) { const tt = t * i / steps; ctx.lineTo(X(tt), Y(f(tt))); }
          ctx.lineTo(X(t), Y(0)); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = GREEN; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) { const tt = t * i / steps; i ? ctx.lineTo(X(tt), Y(f(tt))) : ctx.moveTo(X(tt), Y(f(tt))); }
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(X(t), Y(f(t)), 5, 0, Math.PI * 2); ctx.fill();
      }

      function drawRoad() {
        const { ctx, w, h } = road;
        ctx.clearRect(0, 0, w, h);
        const sMax = niceMax(Math.max(dist(T_END), 10));
        const m = 24, carW = Math.min(70, w * 0.12), carH = carW * 0.42;
        const groundY = h * 0.72;
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, groundY, w, h - groundY);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.moveTo(0, groundY + (h - groundY) / 2); ctx.lineTo(w, groundY + (h - groundY) / 2); ctx.stroke();
        ctx.setLineDash([]);
        const track = w - 2 * m - carW;
        ctx.fillStyle = MUTED; ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center';
        for (let i = 0; i <= 5; i++) {
          const x = m + carW + track * i / 5;
          ctx.fillRect(x - 0.75, 20, 1.5, 6);
          ctx.fillText(`${fmt(sMax * i / 5, 0)} m`, x, 14);
        }
        const s = dist(t);
        const x = m + track * (s / sMax);
        const y = groundY - carH - carW * 0.12;
        // body
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y + carH * 0.35, carW, carH * 0.65, 6) : ctx.rect(x, y + carH * 0.35, carW, carH * 0.65);
        ctx.fill();
        ctx.fillStyle = TEAL;
        ctx.beginPath();
        ctx.moveTo(x + carW * 0.22, y + carH * 0.36); ctx.lineTo(x + carW * 0.34, y); ctx.lineTo(x + carW * 0.7, y); ctx.lineTo(x + carW * 0.84, y + carH * 0.36);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(x + carW * 0.37, y + carH * 0.07, carW * 0.3, carH * 0.27);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(x + carW - 5, y + carH * 0.48, 5, carH * 0.16);
        // wheels
        const r = carW * 0.13;
        [0.24, 0.78].forEach(k => {
          const cx = x + carW * k, cy = groundY - r * 0.1;
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy - r + 2, r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
          const ang = s / 0.35;
          for (let j = 0; j < 3; j++) {
            const th = ang + j * Math.PI * 2 / 3;
            ctx.beginPath(); ctx.moveTo(cx, cy - r + 2); ctx.lineTo(cx + Math.cos(th) * r * 0.7, cy - r + 2 + Math.sin(th) * r * 0.7); ctx.stroke();
          }
        });
      }

      function draw() {
        drawRoad();
        const vMax = niceMax(Math.max(u(), vel(T_END), 1));
        const sMax = niceMax(Math.max(dist(T_END), 1));
        plot(dtc, dist, sMax, 't / s', 'd / m', false);
        plot(vtc, vel, vMax, 't / s', 'v / m/s', true);
        $('#mo-t').textContent = `${t.toFixed(1)} s`;
        $('#mo-v').textContent = `${fmt(vel(t), 1)} m/s`;
        $('#mo-s').textContent = `${fmt(dist(t), 1)} m`;
      }

      const anim = loop(dt => {
        if (!playing) return;
        t = Math.min(T_END, t + dt);
        if (t >= T_END) setPlaying(false);
        draw();
      });
      function setPlaying(p) {
        playing = p;
        playBtn.innerHTML = p ? '<i class="bi bi-pause-fill"></i>Pause' : (t >= T_END ? '<i class="bi bi-arrow-repeat"></i>Replay' : '<i class="bi bi-play-fill"></i>Play');
        if (p) anim.start(); else anim.stop();
      }
      function reset() { setPlaying(false); t = 0; note(); draw(); setPlaying(false); }
      playBtn.addEventListener('click', () => {
        if (playing) return setPlaying(false);
        if (t >= T_END) t = 0;
        setPlaying(true);
      });
      $('#mo-reset').addEventListener('click', reset);
      reset();
      this._pause = () => setPlaying(false);
    },
    stop() { this._pause && this._pause(); }
  });

  /* ======================================================
     Waves
     ====================================================== */
  Lab.register('phy-waves', {
    init() {
      const cv = Lab.canvas($('#wv-canvas'), 0.55);
      let time = 0, paused = false;
      const type = seg($('#wv-type'), () => notes());
      const A = range($('#wv-A'), $('#wv-A-val'), v => `${v} m`);
      const f = range($('#wv-f'), $('#wv-f-val'), v => `${v} Hz`, () => notes());
      const lam = range($('#wv-l'), $('#wv-l-val'), v => `${v} m`, () => notes());
      const WORLD = 8;

      function notes() {
        $('#wv-v').textContent = `${fmt(f.value * lam.value, 2)} m/s`;
        $('#wv-T').textContent = `${fmt(1 / f.value, 2)} s`;
        $('#wv-note').innerHTML = type.value === 'transverse'
          ? 'In a <strong>transverse</strong> wave the particles vibrate <strong>at right angles</strong> to the direction the wave travels. Examples: light, water waves, waves on a string.'
          : 'In a <strong>longitudinal</strong> wave the particles vibrate <strong>parallel</strong> to the direction of travel, making <strong>compressions (C)</strong> and <strong>rarefactions (R)</strong>. Example: sound.';
      }

      function arrow(ctx, x1, y1, x2, y2, color, both) {
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const head = (xa, ya, xb, yb) => {
          const ang = Math.atan2(yb - ya, xb - xa);
          ctx.beginPath(); ctx.moveTo(xb, yb);
          ctx.lineTo(xb - 8 * Math.cos(ang - 0.4), yb - 8 * Math.sin(ang - 0.4));
          ctx.lineTo(xb - 8 * Math.cos(ang + 0.4), yb - 8 * Math.sin(ang + 0.4));
          ctx.closePath(); ctx.fill();
        };
        head(x1, y1, x2, y2);
        if (both) head(x2, y2, x1, y1);
      }

      function draw(dt) {
        if (!paused) time += dt;
        const { ctx, w, h } = cv;
        ctx.clearRect(0, 0, w, h);
        const pad = 18;
        const sx = (w - 2 * pad) / WORLD;
        const cy = h * 0.55;
        const sy = Math.min(sx, (h * 0.36));
        const X = x => pad + x * sx, Y = y => cy - y * sy;
        const k = 2 * Math.PI / lam.value, om = 2 * Math.PI * f.value;
        const amp = A.value;
        const phaseShift = f.value * time;

        ctx.font = '700 12px Inter, sans-serif';
        ctx.fillStyle = MUTED; ctx.textAlign = 'right';
        ctx.fillText('direction of wave travel', w - pad - 34, 18);
        arrow(ctx, w - pad - 30, 14, w - pad, 14, GREEN);

        if (type.value === 'transverse') {
          ctx.setLineDash([5, 5]); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(X(0), cy); ctx.lineTo(X(WORLD), cy); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = TEAL; ctx.lineWidth = 3;
          ctx.beginPath();
          for (let px = 0; px <= w - 2 * pad; px += 2) {
            const x = px / sx;
            const y = amp * Math.sin(k * x - om * time);
            px ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
          }
          ctx.stroke();
          for (let x = 0; x <= WORLD + 1e-6; x += 0.25) {
            const y = amp * Math.sin(k * x - om * time);
            const tracked = Math.abs(x - 2) < 1e-6;
            ctx.fillStyle = tracked ? '#dc2626' : GREEN;
            ctx.beginPath(); ctx.arc(X(x), Y(y), tracked ? 7 : 4, 0, Math.PI * 2); ctx.fill();
          }
          // tracked particle motion range
          ctx.globalAlpha = 0.5; arrow(ctx, X(2) - 14, Y(amp), X(2) - 14, Y(-amp), '#dc2626', true); ctx.globalAlpha = 1;
          // wavelength + amplitude labels on the first full crest-to-crest span
          let crest = lam.value * (0.25 + phaseShift);
          crest = ((crest % lam.value) + lam.value) % lam.value;
          if (crest < 0.3) crest += lam.value;
          if (crest + lam.value <= WORLD - 0.1) {
            const yb = Y(amp) - 16;
            arrow(ctx, X(crest), yb, X(crest + lam.value), yb, INK, true);
            ctx.fillStyle = INK; ctx.textAlign = 'center';
            ctx.fillText(`λ = ${lam.value} m`, X(crest + lam.value / 2), yb - 7);
          }
          if (crest <= WORLD) {
            arrow(ctx, X(crest), cy, X(crest), Y(amp) + 2, '#b45309', false);
            ctx.fillStyle = '#b45309'; ctx.textAlign = 'left';
            ctx.fillText('A', X(crest) + 6, (cy + Y(amp)) / 2 + 4);
          }
        } else {
          const disp = Math.min(amp * 0.45, lam.value * 0.12);
          const half = h * 0.3;
          for (let x0 = 0.06; x0 <= WORLD; x0 += 0.12) {
            const xi = disp * Math.sin(k * x0 - om * time);
            const tracked = Math.abs(x0 - 1.98) < 0.05;
            ctx.strokeStyle = tracked ? '#dc2626' : GREEN;
            ctx.lineWidth = tracked ? 4 : 2.2;
            ctx.beginPath(); ctx.moveTo(X(x0 + xi), cy - half); ctx.lineTo(X(x0 + xi), cy + half); ctx.stroke();
          }
          ctx.globalAlpha = 0.5; arrow(ctx, X(1.98 - disp), cy + half + 12, X(1.98 + disp), cy + half + 12, '#dc2626', true); ctx.globalAlpha = 1;
          ctx.font = '800 13px Inter, sans-serif'; ctx.textAlign = 'center';
          const base = lam.value * phaseShift;
          const comps = [];
          for (let kk = -2; kk < 12; kk++) {
            const xc = base + lam.value * (0.5 + kk), xr = base + lam.value * kk;
            if (xc > 0.2 && xc < WORLD - 0.2) { ctx.fillStyle = INK; ctx.fillText('C', X(xc), cy - half - 8); comps.push(xc); }
            if (xr > 0.2 && xr < WORLD - 0.2) { ctx.fillStyle = MUTED; ctx.fillText('R', X(xr), cy - half - 8); }
          }
          if (comps.length >= 2) {
            const yb = cy + half + 30;
            arrow(ctx, X(comps[0]), yb, X(comps[1]), yb, INK, true);
            ctx.fillStyle = INK; ctx.font = '700 12px Inter, sans-serif';
            ctx.fillText(`λ = ${lam.value} m`, X((comps[0] + comps[1]) / 2), yb + 16);
          }
        }
      }

      this._loop = loop(dt => draw(dt));
      $('#wv-pause').addEventListener('click', e => {
        paused = !paused;
        e.currentTarget.innerHTML = paused ? '<i class="bi bi-play-fill"></i>Resume' : '<i class="bi bi-pause-fill"></i>Pause';
      });
      notes();
    },
    start() { this._loop && this._loop.start(); },
    stop() { this._loop && this._loop.stop(); }
  });

  /* ======================================================
     Circuits
     ====================================================== */
  function pathLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }
  function pointAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= seg) {
        const k = d / seg;
        return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
      }
      d -= seg;
    }
    return pts[pts.length - 1];
  }

  Lab.register('phy-circuits', {
    init() {
      const svg = $('#ck-svg');
      const mode = seg($('#ck-mode'), () => build());
      const flow = seg($('#ck-flow'), () => build());
      const V = range($('#ck-V'), $('#ck-V-val'), v => `${v} V`, () => update());
      const R1 = range($('#ck-R1'), $('#ck-R1-val'), v => `${v} Ω`, () => update());
      const R2 = range($('#ck-R2'), $('#ck-R2-val'), v => `${v} Ω`, () => update());
      let loops = [], lamps = {}, labels = {}, offset = 0;

      // Battery sits on the left wire with its + plate on top; conventional current leaves + and goes up.
      const SERIES_LOOP = [[60, 150], [60, 50], [460, 50], [460, 250], [60, 250], [60, 150]];
      const PAR_LOOP1 = [[60, 150], [60, 50], [400, 50], [400, 250], [60, 250], [60, 150]];
      const PAR_LOOP2 = [[60, 150], [60, 50], [160, 50], [160, 150], [400, 150], [400, 250], [60, 250], [60, 150]];

      function lamp(g, x, y, key) {
        const glow = svgEl('circle', { cx: x, cy: y, r: 20, fill: '#fde047', opacity: 0 }, g);
        const body = svgEl('circle', { cx: x, cy: y, r: 15, fill: '#fff', stroke: INK, 'stroke-width': 2.5 }, g);
        const d = 10.6;
        svgEl('path', { d: `M${x - d} ${y - d} L${x + d} ${y + d} M${x - d} ${y + d} L${x + d} ${y - d}`, stroke: INK, 'stroke-width': 2.2 }, g);
        lamps[key] = { glow, body };
      }
      function text(g, x, y, str, opts = {}) {
        return svgEl('text', { x, y, text: str, 'text-anchor': opts.anchor || 'middle', 'font-size': opts.size || 12, 'font-weight': opts.weight || 700, fill: opts.fill || INK, 'font-family': 'Inter, sans-serif' }, g);
      }

      function build() {
        svg.innerHTML = '';
        lamps = {}; labels = {};
        const wires = svgEl('g', { fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
        const series = mode.value === 'series';
        if (series) {
          svgEl('path', { d: 'M60 135 V50 H460 V250 H60 V165' }, wires);
        } else {
          svgEl('path', { d: 'M60 135 V50 H400 V250 H60 V165' }, wires);
          svgEl('path', { d: 'M160 50 V150 H400' }, wires);
          svgEl('circle', { cx: 160, cy: 50, r: 4.5, fill: INK }, svg);
          svgEl('circle', { cx: 400, cy: 50, r: 4.5, fill: INK }, svg);
          svgEl('circle', { cx: 400, cy: 150, r: 4.5, fill: INK }, svg);
        }
        // battery (cell): long thin plate = +, short thick plate = −
        svgEl('rect', { x: 40, y: 136, width: 40, height: 28, fill: '#f6faf8' }, svg);
        svgEl('line', { x1: 40, y1: 142, x2: 80, y2: 142, stroke: INK, 'stroke-width': 3 }, svg);
        svgEl('line', { x1: 50, y1: 158, x2: 70, y2: 158, stroke: INK, 'stroke-width': 7 }, svg);
        text(svg, 92, 146, '+', { size: 14, fill: '#dc2626' });
        text(svg, 92, 166, '−', { size: 14 });
        labels.V = text(svg, 22, 154, '', { size: 12, anchor: 'middle', fill: GREEN });

        const dots = svgEl('g', {}, svg);
        const comps = svgEl('g', {}, svg);
        if (series) {
          lamp(comps, 190, 50, 'L1'); lamp(comps, 330, 50, 'L2');
          labels.L1a = text(comps, 190, 26, ''); labels.L1b = text(comps, 190, 84, '', { size: 11, fill: GREEN });
          labels.L2a = text(comps, 330, 26, ''); labels.L2b = text(comps, 330, 84, '', { size: 11, fill: GREEN });
          loops = [{ pts: SERIES_LOOP, key: 'I' }];
        } else {
          lamp(comps, 280, 50, 'L1'); lamp(comps, 280, 150, 'L2');
          labels.L1a = text(comps, 280, 26, ''); labels.L1b = text(comps, 280, 84, '', { size: 11, fill: GREEN });
          labels.L2a = text(comps, 280, 126, ''); labels.L2b = text(comps, 280, 184, '', { size: 11, fill: GREEN });
          loops = [{ pts: PAR_LOOP1, key: 'I1' }, { pts: PAR_LOOP2, key: 'I2' }];
        }
        // ammeter in the main line
        svgEl('circle', { cx: 230, cy: 250, r: 15, fill: '#fff', stroke: INK, 'stroke-width': 2.5 }, comps);
        text(comps, 230, 255, 'A', { size: 14 });
        labels.A = text(comps, 230, 285, '', { size: 13, fill: GREEN });

        loops.forEach(lp => {
          lp.len = pathLength(lp.pts);
          lp.dots = [];
          const n = Math.floor(lp.len / 26);
          for (let i = 0; i < n; i++) lp.dots.push(svgEl('circle', { r: 3.6, fill: flow.value === 'conv' ? '#f59e0b' : '#0ea5e9' }, dots));
        });
        update();
      }

      let I = {};
      function update() {
        const v = V.value, r1 = R1.value, r2 = R2.value;
        let Rt, It, I1, I2, V1, V2;
        if (mode.value === 'series') {
          Rt = r1 + r2; It = v / Rt; I1 = I2 = It; V1 = It * r1; V2 = It * r2;
        } else {
          Rt = 1 / (1 / r1 + 1 / r2); I1 = v / r1; I2 = v / r2; It = I1 + I2; V1 = V2 = v;
        }
        I = { I: It, I1, I2 };
        $('#ck-Rt').textContent = `${fmt(Rt, 2)} Ω`;
        $('#ck-I').textContent = `${fmt(It, 2)} A`;
        labels.V.textContent = `${v} V`;
        labels.L1a.textContent = `L₁  ${r1} Ω`;
        labels.L2a.textContent = `L₂  ${r2} Ω`;
        labels.L1b.textContent = `${fmt(V1, 2)} V · ${fmt(I1, 2)} A`;
        labels.L2b.textContent = `${fmt(V2, 2)} V · ${fmt(I2, 2)} A`;
        labels.A.textContent = `${fmt(It, 2)} A`;
        [['L1', V1 * I1], ['L2', V2 * I2]].forEach(([k, P]) => {
          const b = clamp(Math.sqrt(P / 36), 0, 1);
          lamps[k].glow.setAttribute('r', 16 + 22 * b);
          lamps[k].glow.setAttribute('opacity', (0.15 + 0.6 * b) * (b > 0.02 ? 1 : 0));
          lamps[k].body.setAttribute('fill', `rgb(255,${Math.round(255 - 30 * b)},${Math.round(255 - 180 * b)})`);
        });
      }

      this._loop = loop(dt => {
        offset += dt;
        const dir = flow.value === 'conv' ? 1 : -1;
        loops.forEach(lp => {
          const speed = clamp(45 * (I[lp.key] || 0), 0, 340);
          lp.pos = ((lp.pos || 0) + dir * speed * dt + lp.len) % lp.len;
          const spacing = lp.len / lp.dots.length;
          lp.dots.forEach((d, i) => {
            const [x, y] = pointAt(lp.pts, (lp.pos + i * spacing) % lp.len);
            d.setAttribute('cx', x); d.setAttribute('cy', y);
          });
        });
      });
      build();
    },
    start() { this._loop && this._loop.start(); },
    stop() { this._loop && this._loop.stop(); }
  });

  /* ======================================================
     Refraction & TIR
     ====================================================== */
  Lab.register('phy-light', {
    init() {
      const svg = $('#lt-svg');
      const NAMES = { '1.33': 'Water', '1.5': 'Glass', '2.42': 'Diamond' };
      const dir = seg($('#lt-dir'), () => draw());
      const mat = seg($('#lt-mat'), () => draw());
      const iCtl = range($('#lt-i'), $('#lt-i-val'), v => `${v}°`, () => draw());
      const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
      const PX = 260, PY = 160, L = 175;

      function ray(x1, y1, x2, y2, opacity, width = 3.5) {
        svgEl('line', { x1, y1, x2, y2, stroke: '#dc2626', 'stroke-width': width, opacity, 'stroke-linecap': 'round', filter: 'url(#lt-glow)' }, svg);
        // arrowhead at the midpoint pointing along the ray
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1);
        const p = (a, s) => `${mx + s * Math.cos(a)},${my + s * Math.sin(a)}`;
        svgEl('polygon', { points: `${p(ang, 8)} ${p(ang + 2.5, 8)} ${p(ang - 2.5, 8)}`, fill: '#dc2626', opacity }, svg);
      }
      function arcLabel(fromAng, toAng, r, label, color) {
        // angles in SVG radians measured from +x axis
        const x1 = PX + r * Math.cos(fromAng), y1 = PY + r * Math.sin(fromAng);
        const x2 = PX + r * Math.cos(toAng), y2 = PY + r * Math.sin(toAng);
        const sweep = toAng > fromAng ? 1 : 0;
        svgEl('path', { d: `M${x1} ${y1} A${r} ${r} 0 0 ${sweep} ${x2} ${y2}`, fill: 'none', stroke: color, 'stroke-width': 2 }, svg);
        const mid = (fromAng + toAng) / 2;
        svgEl('text', { x: PX + (r + 14) * Math.cos(mid), y: PY + (r + 14) * Math.sin(mid) + 4, text: label, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: color, 'font-family': 'Inter, sans-serif' }, svg);
      }

      function draw() {
        const n = parseFloat(mat.value), i = iCtl.value, out = dir.value === 'out';
        const crit = deg(Math.asin(1 / n));
        svg.innerHTML = '';
        const defs = svgEl('defs', {}, svg);
        const f = svgEl('filter', { id: 'lt-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
        svgEl('feGaussianBlur', { stdDeviation: 2.2, result: 'b' }, f);
        const merge = svgEl('feMerge', {}, f);
        svgEl('feMergeNode', { in: 'b' }, merge);
        svgEl('feMergeNode', { in: 'SourceGraphic' }, merge);

        svgEl('rect', { x: 0, y: 0, width: 520, height: PY, fill: '#f8fafc' }, svg);
        svgEl('rect', { x: 0, y: PY, width: 520, height: 320 - PY, fill: 'rgba(32,201,151,0.16)' }, svg);
        svgEl('line', { x1: 0, y1: PY, x2: 520, y2: PY, stroke: '#198754', 'stroke-width': 2 }, svg);
        const lbl = (x, y, t) => svgEl('text', { x, y, text: t, 'font-size': 14, 'font-weight': 800, fill: '#334155', 'font-family': 'Inter, sans-serif' }, svg);
        lbl(14, 26, 'Air  (n = 1.00)');
        lbl(14, 306, `${NAMES[mat.value]}  (n = ${n})`);
        svgEl('line', { x1: PX, y1: 14, x2: PX, y2: 306, stroke: '#64748b', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }, svg);
        svgEl('text', { x: PX + 6, y: 30, text: 'normal', 'font-size': 11, fill: '#64748b', 'font-family': 'Inter, sans-serif' }, svg);

        const si = Math.sin(rad(i)), ci = Math.cos(rad(i));
        let rTxt, msg, rAngle = null, tir = false;
        if (!out) {
          const r = deg(Math.asin(si / n));
          rAngle = r;
          ray(PX - L * si, PY - L * ci, PX, PY, 1);
          ray(PX, PY, PX + L * Math.sin(rad(r)), PY + L * Math.cos(rad(r)), 1);
          ray(PX, PY, PX + L * si, PY - L * ci, 0.18, 2.5);
          if (i > 0) {
            arcLabel(-Math.PI / 2, -Math.PI / 2 - rad(i), 46, 'i', '#b45309');
            arcLabel(Math.PI / 2, Math.PI / 2 - rad(r), 46, 'r', '#198754');
          }
          rTxt = `${fmt(r, 1)}°`;
          msg = i === 0 ? 'Along the normal the ray goes straight through: it slows down but does not bend.' : `Light <strong>slows down</strong> as it enters the ${NAMES[mat.value].toLowerCase()}, so it bends <strong>towards the normal</strong> (r &lt; i).`;
        } else {
          ray(PX - L * si, PY + L * ci, PX, PY, 1);
          const sr = n * si;
          if (sr < 1) {
            const r = deg(Math.asin(sr));
            rAngle = r;
            ray(PX, PY, PX + L * Math.sin(rad(r)), PY - L * Math.cos(rad(r)), 1);
            ray(PX, PY, PX + L * si, PY + L * ci, clamp(0.18 + 0.8 * Math.pow(i / crit, 6), 0.18, 0.9), 2.5);
            if (i > 0) {
              arcLabel(Math.PI / 2, Math.PI / 2 + rad(i), 46, 'i', '#b45309');
              arcLabel(-Math.PI / 2, -Math.PI / 2 + rad(r), 46, 'r', '#198754');
            }
            rTxt = `${fmt(r, 1)}°`;
            msg = crit - i < 1.5
              ? 'Almost at the <strong>critical angle</strong>: the refracted ray skims along the surface and the reflected ray gets brighter.'
              : 'Light <strong>speeds up</strong> as it leaves, so it bends <strong>away from the normal</strong> (r &gt; i).';
          } else {
            tir = true;
            ray(PX, PY, PX + L * si, PY + L * ci, 1);
            arcLabel(Math.PI / 2, Math.PI / 2 + rad(i), 46, 'i', '#b45309');
            arcLabel(Math.PI / 2, Math.PI / 2 - rad(i), 58, 'i', '#b45309');
            rTxt = 'none (TIR)';
            msg = `<strong>Total internal reflection!</strong> i (${i}°) is bigger than the critical angle (${fmt(crit, 1)}°), so all the light reflects back inside. This is how optical fibres and endoscopes work.`;
          }
        }
        $('#lt-r').textContent = rTxt;
        $('#lt-n').textContent = n.toFixed(2);
        $('#lt-c').textContent = `${fmt(crit, 1)}°`;
        $('#lt-v').textContent = `${(3 / n).toFixed(2)} × 10⁸ m/s`;
        $('#lt-msg').innerHTML = msg + (rAngle !== null && i > 0 && !tir ? `<br><span class="text-muted">Check: sin ${out ? 'r' : 'i'} / sin ${out ? 'i' : 'r'} = ${fmt(Math.sin(rad(out ? rAngle : i)) / Math.sin(rad(out ? i : rAngle)), 2)} = n</span>` : '');
      }
      draw();
    }
  });
})();
