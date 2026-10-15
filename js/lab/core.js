/* MiltonLearn Learning Lab — core: routing between subjects/tools + shared helpers.
   Each tool registers { init, start, stop }. Only the visible tool is started, so
   animations elsewhere on the page never run in the background. */
(function () {
  'use strict';

  const tools = new Map();
  const lastToolBySubject = {};
  let currentId = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
    if (parent) parent.appendChild(el);
    return el;
  }

  function el(tag, attrs = {}, parent) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'class') node.className = v;
      else node.setAttribute(k, v);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  /* Segmented button group: <div class="seg"><button data-v="x">…</button></div> */
  function seg(container, onChange) {
    const buttons = $$('button', container);
    let value = (buttons.find(b => b.classList.contains('active')) || buttons[0]).dataset.v;
    function set(v, fire = true) {
      value = v;
      buttons.forEach(b => b.classList.toggle('active', b.dataset.v === v));
      if (fire && onChange) onChange(v);
    }
    buttons.forEach(b => {
      b.type = 'button';
      b.addEventListener('click', () => set(b.dataset.v));
    });
    set(value, false);
    return { get value() { return value; }, set };
  }

  /* Range slider bound to a value label, with a number box beside it so a value can be
     typed or nudged with the arrow keys. The label's unit (e.g. "m/s") moves next to the box. */
  function range(input, label, fmt = v => v, onInput) {
    const row = el('div', { class: 'range-row' });
    input.parentNode.insertBefore(row, input);
    row.appendChild(input);
    const box = el('span', { class: 'num-box' }, row);
    const num = el('input', {
      type: 'number', class: 'lab-num', min: input.min, max: input.max, step: input.step || 1,
      inputmode: 'decimal', 'aria-label': (input.getAttribute('aria-label') || input.id || 'value') + ' (type a value)'
    }, box);
    const unitEl = el('span', { class: 'num-unit' }, box);
    if (label) label.hidden = true;

    const update = (fire, fromBox = false) => {
      const v = parseFloat(input.value);
      const shown = String(fmt(v));
      if (label) label.textContent = shown;
      unitEl.textContent = shown.replace(String(v), '').trim();
      if (!fromBox) num.value = v;
      if (fire && onInput) onInput(v);
    };
    input.addEventListener('input', () => update(true));
    num.addEventListener('input', () => {
      const v = parseFloat(num.value);
      if (isNaN(v)) return;
      input.value = clamp(v, parseFloat(input.min), parseFloat(input.max));
      update(true, true);
    });
    num.addEventListener('change', () => { num.value = input.value; });
    update(false);
    return {
      get value() { return parseFloat(input.value); },
      set(v, fire = false) { input.value = v; update(fire); },
      setRange(min, max) { input.min = num.min = min; input.max = num.max = max; update(false); }
    };
  }

  /* HiDPI canvas that refits itself to its CSS width. aspect = height / width (or a function of width). */
  function canvas(cv, aspect, onResize) {
    const ctx = cv.getContext('2d');
    const state = { ctx, w: 0, h: 0 };
    function fit(notify = true) {
      const w = cv.clientWidth || cv.parentElement.clientWidth || 600;
      const h = Math.round(w * (typeof aspect === 'function' ? aspect(w) : aspect));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.w = w;
      state.h = h;
      if (notify && onResize) onResize(state);
    }
    state.fit = fit;
    if ('ResizeObserver' in window) {
      let last = 0;
      new ResizeObserver(() => {
        const w = cv.clientWidth;
        if (w && Math.abs(w - last) > 1) { last = w; fit(); }
      }).observe(cv);
    } else {
      window.addEventListener('resize', fit);
    }
    fit(false);
    return state;
  }

  /* requestAnimationFrame loop with dt in seconds; capped so tab switches don't jump. */
  function loop(frame) {
    let raf = 0;
    let last = 0;
    function tick(ts) {
      const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
      last = ts;
      frame(dt, ts / 1000);
      raf = requestAnimationFrame(tick);
    }
    return {
      start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      get running() { return raf !== 0; }
    };
  }

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('ml-lab:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('ml-lab:' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    }
  };

  /* "C2H6O" → C<sub>2</sub>H<sub>6</sub>O */
  const chem = s => String(s).replace(/(\d+)/g, '<sub>$1</sub>');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const rand = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const fmt = (v, dp = 2) => {
    if (!isFinite(v)) return '—';
    const r = Number(v.toFixed(dp));
    return (Object.is(r, -0) ? 0 : r).toString();
  };
  const sf3 = v => (isFinite(v) ? Number(v.toPrecision(3)).toString() : '—');

  /* ---------- Routing ---------- */
  function panelFor(id) { return document.querySelector(`.tool-panel[data-tool="${id}"]`); }

  function showTool(id, { scroll = false, updateHash = true } = {}) {
    const panel = panelFor(id);
    if (!panel) return;
    const subjectPanel = panel.closest('.subject-panel');
    const subject = subjectPanel.dataset.subject;

    if (currentId && currentId !== id) {
      const prev = tools.get(currentId);
      if (prev && prev.stop) prev.stop();
    }

    $$('.subject-panel').forEach(p => { p.hidden = p !== subjectPanel; });
    $$('.subject-tab').forEach(t => {
      const on = t.dataset.subject === subject;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    $$('.tool-panel', subjectPanel).forEach(p => { p.hidden = p !== panel; });
    $$('.tool-pill', subjectPanel).forEach(p => p.classList.toggle('active', p.dataset.tool === id));

    const soon = $('#alevel-soon');
    if (soon && !soon.hidden) {
      soon.hidden = true;
      if ($('.next-up')) $('.next-up').hidden = false;
      $$('.curr-chip').forEach(ch => { const on = ch.dataset.curriculum === 'igcse'; ch.classList.toggle('active', on); ch.setAttribute('aria-checked', on); });
    }

    const def = tools.get(id);
    if (def) {
      if (!def.inited) {
        def.inited = true;
        try { def.init && def.init(panel); } catch (err) { console.error('Lab tool failed to start:', id, err); }
      }
      def.start && def.start();
    }
    currentId = id;
    lastToolBySubject[subject] = id;

    if (updateHash && history.replaceState) history.replaceState(null, '', '#' + id);
    if (scroll) {
      const bar = $('.subject-bar');
      const y = bar.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  /* Only IGCSE is live; AS & A Level shows a coming-soon card in place of the tools. */
  function setCurriculum(c) {
    $$('.curr-chip').forEach(ch => {
      const on = ch.dataset.curriculum === c;
      ch.classList.toggle('active', on);
      ch.setAttribute('aria-checked', on);
    });
    const soon = $('#alevel-soon');
    const teaser = $('.next-up');
    if (teaser) teaser.hidden = c === 'alevel';
    if (c === 'alevel') {
      const cur = currentId && tools.get(currentId);
      if (cur && cur.stop) cur.stop();
      $$('.subject-panel').forEach(p => { p.hidden = true; });
      if (soon) soon.hidden = false;
    } else {
      if (soon) soon.hidden = true;
      if (currentId) showTool(currentId, { updateHash: false });
    }
  }

  function firstToolOf(subject) {
    const pill = document.querySelector(`.subject-panel[data-subject="${subject}"] .tool-pill`);
    return pill ? pill.dataset.tool : null;
  }

  function showSubject(subject, opts) {
    const id = lastToolBySubject[subject] || firstToolOf(subject);
    if (id) showTool(id, opts);
  }

  function route(scroll) {
    const hash = decodeURIComponent(location.hash.replace('#', ''));
    if (hash && panelFor(hash)) return showTool(hash, { scroll });
    if (hash && firstToolOf(hash)) return showSubject(hash, { scroll });
    showTool(firstToolOf('chemistry'), { updateHash: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    $$('.subject-tab').forEach(t => t.addEventListener('click', () => showSubject(t.dataset.subject)));
    $$('.tool-pill').forEach(p => {
      p.type = 'button';
      p.addEventListener('click', () => showTool(p.dataset.tool));
    });
    $$('[data-open]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const target = a.dataset.open;
      if (panelFor(target)) showTool(target, { scroll: true });
      else showSubject(target, { scroll: true });
    }));
    $$('[data-curriculum]').forEach(chip => chip.addEventListener('click', () => setCurriculum(chip.dataset.curriculum)));
    window.addEventListener('hashchange', () => route(true));
    route(!!location.hash);
    const yr = $('#current-year');
    if (yr) yr.textContent = new Date().getFullYear();
  });

  window.Lab = {
    register(id, def) { tools.set(id, Object.assign({ inited: false }, def)); },
    showTool, showSubject,
    $, $$, el, svgEl, seg, range, canvas, loop, store,
    chem, clamp, lerp, ease, smooth, rand, pick, fmt, sf3
  };
})();
