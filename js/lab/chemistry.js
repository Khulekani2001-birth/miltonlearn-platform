/* MiltonLearn Learning Lab: Chemistry tools */
(function () {
  'use strict';
  const { $, $$, svgEl, seg, range, chem, clamp, lerp, ease, smooth, rand, pick, loop } = Lab;

  const ATOM_STYLE = {
    C: { r: 18, light: '#64748b', dark: '#1e293b', text: '#fff', ink: '#1e293b' },
    H: { r: 11, light: '#ffffff', dark: '#cbd5e1', text: '#334155', ink: '#475569' },
    O: { r: 16, light: '#fca5a5', dark: '#dc2626', text: '#fff', ink: '#dc2626' },
    Br: { r: 20, light: '#d6865a', dark: '#8a3b12', text: '#fff', ink: '#9a3412' }
  };
  const MASS = { C: 12, H: 1, O: 16, Br: 80 };

  function addGradients(svg, prefix) {
    const defs = svgEl('defs', {}, svg);
    for (const [el, s] of Object.entries(ATOM_STYLE)) {
      const g = svgEl('radialGradient', { id: `${prefix}-${el}`, cx: '35%', cy: '30%', r: '70%' }, defs);
      svgEl('stop', { offset: '0%', 'stop-color': s.light }, g);
      svgEl('stop', { offset: '100%', 'stop-color': s.dark }, g);
    }
  }

  /* ======================================================
     Organic molecule builder
     ====================================================== */
  const PREFIX = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct'];
  const SERIES = {
    alkane: {
      min: 1, posLabel: '',
      general: 'C<sub>n</sub>H<sub>2n+2</sub>',
      facts: '<h6>Alkanes: saturated hydrocarbons</h6><p>Only single C–C bonds. They burn in oxygen (combustion) and react with chlorine in UV light (<strong>substitution</strong>). Found in crude oil and natural gas.</p>'
    },
    alkene: {
      min: 2, posLabel: 'Position of C=C',
      general: 'C<sub>n</sub>H<sub>2n</sub>',
      facts: '<h6>Alkenes: unsaturated hydrocarbons</h6><p>Contain a C=C double bond, so they <strong>decolourise bromine water</strong> (addition). Made by cracking long alkanes. They join together to make addition polymers.</p>'
    },
    alcohol: {
      min: 1, posLabel: 'Position of –OH',
      general: 'C<sub>n</sub>H<sub>2n+1</sub>OH',
      facts: '<h6>Alcohols: functional group –OH</h6><p>Ethanol is made by <strong>fermentation</strong> of glucose or by <strong>hydration</strong> of ethene with steam. Used as fuels and solvents; oxidised to carboxylic acids.</p>'
    },
    acid: {
      min: 1, posLabel: '',
      general: 'C<sub>n</sub>H<sub>2n+1</sub>COOH',
      facts: '<h6>Carboxylic acids: functional group –COOH</h6><p><strong>Weak acids</strong>: react with carbonates to give CO<sub>2</sub> and with alcohols to make <strong>esters</strong>. Ethanoic acid is the acid in vinegar.</p>'
    }
  };

  function positionCount(series, n) {
    if (series === 'alkene') return n >= 4 ? Math.floor(n / 2) : 1;
    if (series === 'alcohol') return n >= 3 ? Math.ceil(n / 2) : 1;
    return 0;
  }

  function moleculeName(series, n, pos) {
    const p = PREFIX[n - 1];
    if (series === 'alkane') return p + 'ane';
    if (series === 'alkene') return n === 2 ? 'ethene' : n === 3 ? 'propene' : `${p}-${pos}-ene`;
    if (series === 'alcohol') return n <= 2 ? p + 'anol' : `${p}an-${pos}-ol`;
    return p + 'anoic acid';
  }

  /* Builds a straight-chain molecule as atoms + bonds with 2D layout coordinates. */
  function buildMolecule(series, n, pos) {
    const S = 70, L = 52;
    const atoms = [], bonds = [];
    const add = (el, x, y) => { atoms.push({ el, x, y }); return atoms.length - 1; };
    const bond = (a, b, order = 1) => bonds.push({ a, b, order });
    const carbons = [];
    for (let i = 0; i < n; i++) carbons.push(add('C', i * S, 0));
    for (let i = 0; i < n - 1; i++) bond(carbons[i], carbons[i + 1], series === 'alkene' && i === pos - 1 ? 2 : 1);

    const OFF = { up: [0, -L], down: [0, L], left: [-L, 0], right: [L, 0] };
    for (let i = 0; i < n; i++) {
      const c = carbons[i], cx = i * S;
      let slots = ['up', 'down'];
      if (i === 0) slots.push('left');
      if (i === n - 1) slots.push('right');
      let used = bonds.filter(b => b.a === c || b.b === c).reduce((s, b) => s + b.order, 0);
      const take = s => { slots = slots.filter(x => x !== s); };

      if (series === 'alcohol' && i === pos - 1) {
        const o = add('O', cx, L); bond(c, o);
        bond(o, add('H', cx, 2 * L));
        take('down'); used += 1;
      }
      const isAcidC = series === 'acid' && i === n - 1;
      if (isAcidC) {
        bond(c, add('O', cx, -L), 2);
        const o = add('O', cx + L, 0); bond(c, o);
        bond(o, add('H', cx + L + 46, 0));
        take('up'); take('right'); used += 3;
      }
      const pref = isAcidC ? ['left', 'down'] : ['up', 'down', 'left', 'right'];
      for (let k = used; k < 4; k++) {
        const s = pref.find(x => slots.includes(x));
        if (!s) break;
        take(s);
        bond(c, add('H', cx + OFF[s][0], OFF[s][1]));
      }
    }
    return { atoms, bonds, carbons };
  }

  function molecularFormula(mol) {
    const count = { C: 0, H: 0, O: 0 };
    mol.atoms.forEach(a => { count[a.el]++; });
    const part = (el) => (count[el] ? el + (count[el] > 1 ? count[el] : '') : '');
    return part('C') + part('H') + part('O');
  }

  function structuralFormula(mol, series, n, pos) {
    const hOn = mol.carbons.map(c => mol.bonds.filter(b => (b.a === c && mol.atoms[b.b].el === 'H') || (b.b === c && mol.atoms[b.a].el === 'H')).length);
    let order = [...Array(n).keys()];
    if (series === 'alcohol' && pos === 1 && n > 1) order.reverse();
    let out = '';
    order.forEach((i, k) => {
      let s;
      if (series === 'acid' && i === n - 1) s = n === 1 ? 'HCOOH' : 'COOH';
      else {
        const h = hOn[i];
        s = 'C' + (h ? 'H' + (h > 1 ? h : '') : '');
        if (series === 'alcohol' && i === pos - 1) s += (k === order.length - 1) ? 'OH' : '(OH)';
      }
      if (k > 0) {
        const prev = order[k - 1];
        if (series === 'alkene' && Math.min(prev, i) === pos - 1) out += '=';
      }
      out += s;
    });
    return out;
  }

  function molarMass(mol) { return mol.atoms.reduce((s, a) => s + MASS[a.el], 0); }

  /* Renders a molecule into an SVG; returns a handle that can reposition atoms (for vibration). */
  function renderMolecule(svg, mol, view, prefix) {
    svg.innerHTML = '';
    addGradients(svg, prefix);
    const xs = mol.atoms.map(a => a.x), ys = mol.atoms.map(a => a.y);
    let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 34;
    let w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
    const W = Math.max(w, 460), H = Math.max(h, 240);
    const ox = minX - pad - (W - w) / 2, oy = minY - pad - (H - h) / 2;
    svg.setAttribute('viewBox', `${ox} ${oy} ${W} ${H}`);

    const ball = view === 'ball';
    const bondLayer = svgEl('g', {}, svg);
    const atomLayer = svgEl('g', {}, svg);
    const bondNodes = mol.bonds.map((b, i) => {
      const lines = [];
      for (let k = 0; k < b.order; k++) {
        lines.push(svgEl('line', {
          stroke: ball ? '#94a3b8' : '#334155',
          'stroke-width': ball ? (b.order > 1 ? 4.5 : 6) : 2.6,
          'stroke-linecap': 'round',
          class: 'bond-anim',
          style: `animation-delay:${i * 18}ms`
        }, bondLayer));
      }
      return { ...b, lines };
    });
    const atomNodes = mol.atoms.map((a, i) => {
      const outer = svgEl('g', {}, atomLayer);
      const inner = svgEl('g', { class: 'atom-anim', style: `animation-delay:${i * 22}ms` }, outer);
      const st = ATOM_STYLE[a.el];
      if (ball) {
        svgEl('circle', { r: st.r, fill: `url(#${prefix}-${a.el})`, stroke: a.el === 'H' ? '#94a3b8' : 'none', 'stroke-width': 1 }, inner);
        svgEl('text', { text: a.el, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: st.text, 'font-size': a.el === 'H' ? 10 : 13, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, inner);
      } else {
        svgEl('text', { text: a.el, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: st.ink, 'font-size': 22, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, inner);
      }
      return outer;
    });

    function place(pos) {
      pos.forEach((p, i) => atomNodes[i].setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`));
      bondNodes.forEach(b => {
        const A = pos[b.a], B = pos[b.b];
        const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const trimA = ball ? 0 : 13, trimB = ball ? 0 : 13;
        const gap = ball ? 5 : 4;
        b.lines.forEach((ln, k) => {
          const off = b.order === 1 ? 0 : (k === 0 ? -gap : gap);
          const px = -uy * off, py = ux * off;
          ln.setAttribute('x1', A.x + ux * trimA + px);
          ln.setAttribute('y1', A.y + uy * trimA + py);
          ln.setAttribute('x2', B.x - ux * trimB + px);
          ln.setAttribute('y2', B.y - uy * trimB + py);
        });
      });
    }
    place(mol.atoms);
    return { place };
  }

  Lab.register('chem-organic', {
    init(panel) {
      const svg = $('#org-svg');
      const nameEl = $('#org-name');
      const nIn = $('#org-n'), posIn = $('#org-pos');
      const posGroup = $('#org-pos-group');
      const quizBox = $('#org-quiz-box'), quizInput = $('#org-quiz-input'), quizFb = $('#org-quiz-fb');
      const vibBtn = $('#org-vibrate'), quizBtn = $('#org-quiz');
      let handle = null, mol = null;
      let quiz = { active: false, answer: '', streak: 0 };
      let vibrating = false;
      const phases = [];

      const series = seg($('#org-series'), () => { exitQuiz(); clampControls(); update(); });
      const view = seg($('#org-view'), () => update());
      const nCtl = range(nIn, $('#org-n-val'), v => v, () => { exitQuiz(); clampControls(); update(); });
      const posCtl = range(posIn, $('#org-pos-val'), v => v, () => { exitQuiz(); update(); });

      function clampControls() {
        const s = SERIES[series.value];
        nIn.min = s.min;
        if (nCtl.value < s.min) nCtl.set(s.min);
        nCtl.set(nCtl.value);
        const count = positionCount(series.value, nCtl.value);
        posGroup.hidden = count < 2;
        $('#org-pos-label').textContent = s.posLabel || 'Position';
        posCtl.setRange(1, Math.max(1, count));
        if (posCtl.value > count) posCtl.set(Math.max(1, count));
      }

      function update() {
        const s = series.value, n = nCtl.value, pos = posGroup.hidden ? 1 : posCtl.value;
        mol = buildMolecule(s, n, pos);
        handle = renderMolecule(svg, mol, view.value, 'org');
        phases.length = 0;
        mol.atoms.forEach(() => phases.push([Math.random() * 6.28, Math.random() * 6.28, 7 + Math.random() * 5]));
        $('#org-view-label').textContent = view.value === 'ball' ? 'Ball & stick model' : 'Displayed formula';
        const name = moleculeName(s, n, pos);
        quiz.answer = name;
        nameEl.textContent = quiz.active ? 'Name me!' : name;
        nameEl.classList.toggle('hidden-name', false);
        $('#org-mf').innerHTML = chem(molecularFormula(mol));
        $('#org-sf').innerHTML = chem(structuralFormula(mol, s, n, pos));
        $('#org-gf').innerHTML = SERIES[s].general;
        $('#org-mr').textContent = molarMass(mol);
        $('#org-state').textContent = (s === 'alkane' || s === 'alkene') && n <= 4 ? 'Gas' : 'Liquid';
        $('#org-facts').innerHTML = SERIES[s].facts;
      }

      const vib = loop((dt, t) => {
        if (!mol || !handle) return;
        const amp = view.value === 'ball' ? 3.2 : 2.4;
        handle.place(mol.atoms.map((a, i) => {
          const [p1, p2, f] = phases[i];
          const k = a.el === 'H' ? 1.6 : 1;
          return { x: a.x + Math.sin(t * f + p1) * amp * k, y: a.y + Math.sin(t * f * 1.13 + p2) * amp * k };
        }));
      });

      vibBtn.addEventListener('click', () => {
        vibrating = !vibrating;
        vibBtn.classList.toggle('on', vibrating);
        if (vibrating) vib.start();
        else { vib.stop(); handle && handle.place(mol.atoms); }
      });

      /* Quiz */
      const norm = s => s.toLowerCase().replace(/[\s\-–]/g, '');
      function accepted(answer) {
        const list = [answer];
        if (answer === 'propene') list.push('prop-1-ene');
        if (answer === 'ethene') list.push('eth-1-ene');
        return list.map(norm);
      }
      function newQuiz() {
        const s = pick(Object.keys(SERIES));
        series.set(s, false);
        const n = rand(SERIES[s].min, s === 'alkane' ? 6 : 5);
        nCtl.set(n);
        clampControls();
        const count = positionCount(s, n);
        if (count > 1) posCtl.set(rand(1, count));
        quiz.active = true;
        quizBox.hidden = false;
        quizInput.value = '';
        quizFb.textContent = '';
        quizFb.className = 'feedback mt-2';
        update();
        quizInput.focus({ preventScroll: true });
      }
      function exitQuiz() {
        if (!quiz.active) return;
        quiz.active = false;
        quizBox.hidden = true;
        quizBtn.classList.remove('on');
      }
      function check() {
        if (!quiz.active) return;
        const ok = accepted(quiz.answer).includes(norm(quizInput.value));
        if (ok) {
          quiz.streak++;
          quizFb.textContent = `✔ Correct, it's ${quiz.answer}! Next one coming…`;
          quizFb.className = 'feedback mt-2 ok';
          nameEl.textContent = quiz.answer;
          setTimeout(() => { if (quiz.active) newQuiz(); }, 1400);
        } else {
          quiz.streak = 0;
          quizFb.innerHTML = `✘ Not quite. Count the carbons (${PREFIX[nCtl.value - 1]}-), find the functional group, then number from the end nearest to it.`;
          quizFb.className = 'feedback mt-2 bad';
        }
        $('#org-streak').textContent = quiz.streak;
      }
      quizBtn.addEventListener('click', () => {
        if (quiz.active) { exitQuiz(); update(); return; }
        quizBtn.classList.add('on');
        newQuiz();
      });
      $('#org-quiz-check').addEventListener('click', check);
      $('#org-quiz-next').addEventListener('click', () => { quizFb.textContent = `It was ${quiz.answer}.`; quizFb.className = 'feedback mt-2'; setTimeout(newQuiz, 900); });
      quizInput.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });

      clampControls();
      update();
      this._stopVib = () => vib.stop();
      this._resumeVib = () => { if (vibrating) vib.start(); };
    },
    start() { this._resumeVib && this._resumeVib(); },
    stop() { this._stopVib && this._stopVib(); }
  });

  /* ======================================================
     Reaction animator
     ====================================================== */
  const ETHENE_FROM = {
    C1: [80, 140], C2: [130, 140],
    H1: [55, 97], H2: [55, 183], H3: [155, 97], H4: [155, 183]
  };
  const ETHENE_BONDS = [['C1', 'C2', 2], ['C1', 'H1'], ['C1', 'H2'], ['C2', 'H3'], ['C2', 'H4']];
  const SATURATED = [['C1', 'C2'], ['C1', 'H1'], ['C1', 'H2'], ['C2', 'H3'], ['C2', 'H4']];
  const PRODUCT_CH = { C1: [170, 140], C2: [225, 140], H1: [125, 140], H2: [170, 186], H3: [270, 140], H4: [225, 186] };

  function etheneAtoms() {
    return Object.keys(ETHENE_FROM).map(id => ({ id, el: id[0], from: ETHENE_FROM[id], to: PRODUCT_CH[id] }));
  }

  const REACTIONS = {
    bromine: {
      atoms: [...etheneAtoms(),
        { id: 'Br1', el: 'Br', from: [250, 80], to: [170, 84] },
        { id: 'Br2', el: 'Br', from: [308, 80], to: [225, 84] }],
      before: [...ETHENE_BONDS, ['Br1', 'Br2']],
      after: [...SATURATED, ['C1', 'Br1'], ['C2', 'Br2']],
      labelsBefore: [[105, 232, 'ethene'], [279, 40, 'bromine'], [200, 120, '+']],
      labelsAfter: [[197, 232, '1,2-dibromoethane']],
      eq: 'C2H4 + Br2 → C2H4Br2',
      type: 'Addition',
      cond: 'Room temperature (bromine water)',
      obs: 'Bromine water changes from <strong>orange to colourless</strong>. This is the test for a C=C double bond; alkanes leave it orange.',
      tube: true
    },
    hydrogenation: {
      atoms: [...etheneAtoms(),
        { id: 'Ha', el: 'H', from: [258, 85], to: [170, 95] },
        { id: 'Hb', el: 'H', from: [302, 85], to: [225, 95] }],
      before: [...ETHENE_BONDS, ['Ha', 'Hb']],
      after: [...SATURATED, ['C1', 'Ha'], ['C2', 'Hb']],
      labelsBefore: [[105, 232, 'ethene'], [280, 50, 'hydrogen'], [205, 120, '+']],
      labelsAfter: [[197, 232, 'ethane']],
      eq: 'C2H4 + H2 → C2H6',
      type: 'Addition (hydrogenation)',
      cond: 'Nickel catalyst, about 150 °C',
      obs: 'No colour change. The unsaturated alkene becomes a saturated alkane; the same reaction hardens vegetable oils into margarine.',
      badge: ['Ni catalyst', '150 °C']
    },
    hydration: {
      atoms: [...etheneAtoms(),
        { id: 'O', el: 'O', from: [272, 92], to: [225, 88] },
        { id: 'Ha', el: 'H', from: [240, 118], to: [170, 95] },
        { id: 'Hb', el: 'H', from: [304, 118], to: [225, 42] }],
      before: [...ETHENE_BONDS, ['O', 'Ha'], ['O', 'Hb']],
      after: [...SATURATED, ['C1', 'Ha'], ['C2', 'O'], ['O', 'Hb']],
      labelsBefore: [[105, 232, 'ethene'], [272, 55, 'steam'], [205, 120, '+']],
      labelsAfter: [[197, 232, 'ethanol']],
      eq: 'C2H4 + H2O → C2H5OH',
      type: 'Addition (hydration)',
      cond: 'Steam, 300 °C, 6000 kPa, phosphoric acid catalyst',
      obs: 'The industrial way to make ethanol: fast and continuous with a pure product, but it uses ethene from non-renewable crude oil.',
      badge: ['H₃PO₄ catalyst', '300 °C', '6000 kPa']
    },
    combustion: {
      atoms: [
        { id: 'C', el: 'C', from: [90, 130], to: [195, 72] },
        { id: 'Hu', el: 'H', from: [90, 85], to: [242, 208] },
        { id: 'Hd', el: 'H', from: [90, 175], to: [160, 208] },
        { id: 'Hl', el: 'H', from: [45, 130], to: [100, 208] },
        { id: 'Hr', el: 'H', from: [135, 130], to: [302, 208] },
        { id: 'Oa1', el: 'O', from: [242, 72], to: [140, 72] },
        { id: 'Oa2', el: 'O', from: [292, 72], to: [250, 72] },
        { id: 'Ob1', el: 'O', from: [242, 185], to: [130, 178] },
        { id: 'Ob2', el: 'O', from: [292, 185], to: [272, 178] }
      ],
      before: [['C', 'Hu'], ['C', 'Hd'], ['C', 'Hl'], ['C', 'Hr'], ['Oa1', 'Oa2', 2], ['Ob1', 'Ob2', 2]],
      after: [['C', 'Oa1', 2], ['C', 'Oa2', 2], ['Ob1', 'Hl'], ['Ob1', 'Hd'], ['Ob2', 'Hu'], ['Ob2', 'Hr']],
      labelsBefore: [[90, 225, 'methane'], [267, 132, 'oxygen × 2'], [185, 132, '+']],
      labelsAfter: [[195, 36, 'carbon dioxide'], [201, 248, 'water × 2']],
      eq: 'CH4 + 2O2 → CO2 + 2H2O',
      type: 'Complete combustion',
      cond: 'Plenty of oxygen, ignition',
      obs: 'A clean blue flame and lots of heat released (<strong>exothermic</strong>). With too little oxygen, poisonous carbon monoxide forms instead.',
      badge: ['Exothermic', 'heat released']
    }
  };

  Lab.register('chem-reactions', {
    init() {
      const svg = $('#rx-svg');
      const scrub = $('#rx-t');
      const playBtn = $('#rx-play');
      let rx, nodes, t = 0, playing = false;

      function build(key) {
        rx = REACTIONS[key];
        svg.innerHTML = '';
        addGradients(svg, 'rx');
        const byId = {};
        rx.atoms.forEach(a => { byId[a.id] = a; });
        const keyOf = (a, b) => [a, b].sort().join('|');
        const map = new Map();
        rx.before.forEach(([a, b, o = 1]) => map.set(keyOf(a, b), { a, b, ob: o, oa: 0 }));
        rx.after.forEach(([a, b, o = 1]) => {
          const k = keyOf(a, b);
          if (map.has(k)) map.get(k).oa = o; else map.set(k, { a, b, ob: 0, oa: o });
        });
        const bondLayer = svgEl('g', {}, svg);
        const bonds = [...map.values()].map(b => ({
          ...b,
          l1: svgEl('line', { stroke: '#94a3b8', 'stroke-width': 6, 'stroke-linecap': 'round' }, bondLayer),
          l2: svgEl('line', { stroke: '#94a3b8', 'stroke-width': 6, 'stroke-linecap': 'round' }, bondLayer)
        }));
        const atomLayer = svgEl('g', {}, svg);
        const atoms = rx.atoms.map(a => {
          const st = ATOM_STYLE[a.el];
          const g = svgEl('g', {}, atomLayer);
          svgEl('circle', { r: st.r, fill: `url(#rx-${a.el})`, stroke: a.el === 'H' ? '#94a3b8' : 'none' }, g);
          svgEl('text', { text: a.el, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: st.text, 'font-size': a.el === 'H' ? 10 : 12, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, g);
          return { a, g, x: 0, y: 0 };
        });
        const label = ([x, y, txt]) => svgEl('text', { x, y, text: txt, 'text-anchor': 'middle', 'font-size': txt === '+' ? 26 : 13, 'font-weight': 700, fill: '#334155', 'font-family': 'Inter, sans-serif' }, svg);
        const lb = rx.labelsBefore.map(label), la = rx.labelsAfter.map(label);

        let tube = null;
        if (rx.tube) {
          const g = svgEl('g', { transform: 'translate(410 50)' }, svg);
          tube = svgEl('path', { d: 'M4 70 V150 a18 18 0 0 0 36 0 V70 Z', fill: '#e07b00' }, g);
          svgEl('path', { d: 'M2 0 V150 a20 20 0 0 0 40 0 V0', fill: 'none', stroke: '#64748b', 'stroke-width': 3 }, g);
          svgEl('line', { x1: -4, y1: 0, x2: 48, y2: 0, stroke: '#64748b', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
          svgEl('text', { x: 22, y: 196, text: 'bromine water', 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: '#475569', 'font-family': 'Inter, sans-serif' }, g);
        } else if (rx.badge) {
          const g = svgEl('g', { transform: 'translate(372 92)' }, svg);
          svgEl('rect', { x: 0, y: 0, width: 98, height: 22 + rx.badge.length * 18, rx: 10, fill: '#e8f7f0', stroke: '#198754' }, g);
          rx.badge.forEach((txt, i) => svgEl('text', { x: 49, y: 24 + i * 18, text: txt, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#157347', 'font-family': 'Inter, sans-serif' }, g));
        }

        nodes = { byId, bonds, atoms, lb, la, tube };
        $('#rx-eq').innerHTML = '<strong>Equation:</strong> ' + chem(rx.eq);
        $('#rx-type').textContent = rx.type;
        $('#rx-cond').textContent = rx.cond;
        $('#rx-obs').innerHTML = rx.obs;
        draw(0);
      }

      function draw(tt) {
        t = tt;
        scrub.value = Math.round(t * 1000);
        const m = ease(clamp((t - 0.05) / 0.8, 0, 1));
        const pos = {};
        nodes.atoms.forEach(n => {
          const x = lerp(n.a.from[0], n.a.to[0], m), y = lerp(n.a.from[1], n.a.to[1], m);
          pos[n.a.id] = { x, y };
          n.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        });
        const fadeOut = 1 - smooth(0.22, 0.48, t), fadeIn = smooth(0.52, 0.8, t);
        nodes.bonds.forEach(b => {
          const A = pos[b.a], B = pos[b.b];
          const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len * 5, ny = dx / len * 5;
          const single = (b.ob ? fadeOut : 0) + (b.oa ? fadeIn : 0);
          const dbl = (b.ob >= 2 ? fadeOut : 0) + (b.oa >= 2 ? fadeIn : 0);
          const persists = b.ob && b.oa;
          const o1 = persists ? 1 : clamp(single, 0, 1);
          const o2 = clamp(b.ob >= 2 && b.oa >= 2 ? 1 : dbl, 0, 1);
          const spread = o2;
          b.l1.setAttribute('x1', A.x + nx * spread); b.l1.setAttribute('y1', A.y + ny * spread);
          b.l1.setAttribute('x2', B.x + nx * spread); b.l1.setAttribute('y2', B.y + ny * spread);
          b.l2.setAttribute('x1', A.x - nx); b.l2.setAttribute('y1', A.y - ny);
          b.l2.setAttribute('x2', B.x - nx); b.l2.setAttribute('y2', B.y - ny);
          b.l1.setAttribute('opacity', o1);
          b.l1.setAttribute('stroke-width', o2 > 0.05 ? 4.5 : 6);
          b.l2.setAttribute('opacity', o2);
          b.l2.setAttribute('stroke-width', 4.5);
        });
        nodes.lb.forEach(n => n.setAttribute('opacity', 1 - smooth(0, 0.18, t)));
        nodes.la.forEach(n => n.setAttribute('opacity', smooth(0.82, 1, t)));
        if (nodes.tube) {
          const k = smooth(0.45, 0.92, t);
          const r = Math.round(lerp(224, 236, k)), g = Math.round(lerp(123, 246, k)), bl = Math.round(lerp(0, 241, k));
          nodes.tube.setAttribute('fill', `rgb(${r},${g},${bl})`);
        }
      }

      const anim = loop(dt => {
        if (!playing) return;
        let nt = t + dt / 3.4;
        if (nt >= 1) { nt = 1; setPlaying(false); }
        draw(nt);
      });
      function setPlaying(p) {
        playing = p;
        playBtn.innerHTML = p ? '<i class="bi bi-pause-fill"></i>Pause' : (t >= 1 ? '<i class="bi bi-arrow-repeat"></i>Replay' : '<i class="bi bi-play-fill"></i>Play');
        if (p) anim.start(); else anim.stop();
      }
      playBtn.addEventListener('click', () => {
        if (playing) return setPlaying(false);
        if (t >= 1) draw(0);
        setPlaying(true);
      });
      scrub.addEventListener('input', () => { setPlaying(false); draw(scrub.value / 1000); setPlaying(false); });
      seg($('#rx-pick'), v => { setPlaying(false); build(v); setPlaying(false); });
      build('bromine');
      setPlaying(false);
      this._pause = () => setPlaying(false);
    },
    start() {},
    stop() { this._pause && this._pause(); }
  });

  /* ======================================================
     Atom builder (Bohr model)
     ====================================================== */
  const ELEMENTS = [
    ['H', 'Hydrogen', 0], ['He', 'Helium', 2], ['Li', 'Lithium', 4], ['Be', 'Beryllium', 5], ['B', 'Boron', 6],
    ['C', 'Carbon', 6], ['N', 'Nitrogen', 7], ['O', 'Oxygen', 8], ['F', 'Fluorine', 10], ['Ne', 'Neon', 10],
    ['Na', 'Sodium', 12], ['Mg', 'Magnesium', 12], ['Al', 'Aluminium', 14], ['Si', 'Silicon', 14], ['P', 'Phosphorus', 16],
    ['S', 'Sulfur', 16], ['Cl', 'Chlorine', 18], ['Ar', 'Argon', 22], ['K', 'Potassium', 20], ['Ca', 'Calcium', 20]
  ];
  const ANION = { H: 'Hydride', C: 'Carbide', N: 'Nitride', O: 'Oxide', F: 'Fluoride', P: 'Phosphide', S: 'Sulfide', Cl: 'Chloride' };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const CAP = [2, 8, 8, 2];

  function shells(e) {
    const out = [];
    let left = e;
    for (const c of CAP) {
      if (left <= 0) break;
      out.push(Math.min(c, left));
      left -= c;
    }
    return out;
  }

  Lab.register('chem-atom', {
    init(panel) {
      const state = { p: 6, n: 6, e: 6 };
      const LIMIT = { p: [1, 20], n: [0, 30], e: [0, 20] };
      const cv = Lab.canvas($('#atom-canvas'), 0.82, () => draw(0));
      let time = 0;

      function render() {
        const [sym, name, commonN] = ELEMENTS[state.p - 1];
        const A = state.p + state.n, charge = state.p - state.e;
        const conf = shells(state.e);
        const chargeStr = charge === 0 ? '' : (Math.abs(charge) === 1 ? '' : Math.abs(charge)) + (charge > 0 ? '+' : '−');
        $('#atom-p').textContent = state.p;
        $('#atom-n').textContent = state.n;
        $('#atom-e').textContent = state.e;
        $('#atom-A').textContent = A;
        $('#atom-Z').textContent = state.p;
        $('#atom-sym').innerHTML = sym + (chargeStr ? `<sup>${chargeStr}</sup>` : '');
        $('#atom-name').textContent = charge === 0 ? name : (charge < 0 && ANION[sym] ? ANION[sym] : name) + ' ion';
        $('#atom-config').textContent = conf.length ? conf.join(',') : '(none)';
        $('#atom-charge').textContent = charge === 0 ? '0' : chargeStr;
        const neutral = shells(state.p);
        const outer = neutral[neutral.length - 1];
        const group = state.p === 1 ? '—' : ([2, 10, 18].includes(state.p) ? 'VIII' : ROMAN[outer]);
        $('#atom-gp').textContent = `${group} / ${neutral.length}`;

        const notes = [];
        if (state.n !== commonN) notes.push(`<strong>${name}-${A}</strong> is an <strong>isotope</strong>: same number of protons (${state.p}), different number of neutrons (${state.n}; the common form has ${commonN}).`);
        if (charge > 0) notes.push(`Positive ion: the atom has <strong>lost ${charge} electron${charge > 1 ? 's' : ''}</strong>.`);
        if (charge < 0) notes.push(`Negative ion: the atom has <strong>gained ${-charge} electron${charge < -1 ? 's' : ''}</strong>.`);
        if (Math.abs(charge) > 3) notes.push('⚠ Ions with a charge bigger than 3 are very unlikely to form in IGCSE chemistry.');
        const last = conf[conf.length - 1];
        if (state.e > 0 && last === CAP[conf.length - 1] && !(conf.length === 4)) notes.push('✔ Full outer shell: a stable, noble gas electronic configuration.');
        if (state.e === 0) notes.push('No electrons at all: just a bare nucleus!');
        if (!notes.length) notes.push(`A neutral <strong>${name}</strong> atom: ${state.p} protons, ${state.n} neutrons and ${state.e} electrons. Try removing or adding electrons to make an ion.`);
        $('#atom-note').innerHTML = notes.join('<br>');
      }

      // Distribute protons and neutrons evenly through the nucleus.
      function nucleusLayout() {
        const total = state.p + state.n;
        const out = [];
        for (let i = 0; i < total; i++) {
          const isP = Math.floor((i + 1) * state.p / total) > Math.floor(i * state.p / total);
          out.push(isP);
        }
        return out;
      }

      function draw(dt) {
        time += dt;
        const { ctx, w, h } = cv;
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, m = Math.min(w, h);
        const conf = shells(state.e);
        const nShells = Math.max(conf.length, shells(state.p).length, 1);
        const pr = Math.max(3.2, Math.min(6, m / 70));
        const total = state.p + state.n;
        const nucR = pr * 1.15 * Math.sqrt(total) + pr;
        const r0 = Math.max(nucR + m * 0.07, m * 0.15);
        const gap = Math.min((m * 0.47 - r0) / Math.max(nShells - 1, 1), m * 0.11);

        // shells
        for (let k = 0; k < nShells; k++) {
          ctx.beginPath();
          ctx.arc(cx, cy, r0 + k * gap, 0, Math.PI * 2);
          ctx.strokeStyle = k < conf.length ? 'rgba(25,135,84,0.35)' : 'rgba(148,163,184,0.3)';
          ctx.lineWidth = 2;
          ctx.setLineDash(k < conf.length ? [] : [5, 6]);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // nucleus glow + particles
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, nucR * 1.8);
        glow.addColorStop(0, 'rgba(239,68,68,0.18)');
        glow.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cx, cy, nucR * 1.8, 0, Math.PI * 2); ctx.fill();
        const layout = nucleusLayout();
        layout.forEach((isP, i) => {
          const rr = pr * 1.15 * Math.sqrt(i + 0.5);
          const th = i * 2.39996 + time * 0.15;
          const x = cx + rr * Math.cos(th), y = cy + rr * Math.sin(th);
          const g = ctx.createRadialGradient(x - pr * 0.3, y - pr * 0.3, 0, x, y, pr);
          g.addColorStop(0, isP ? '#fca5a5' : '#e2e8f0');
          g.addColorStop(1, isP ? '#dc2626' : '#64748b');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
        });

        // electrons
        conf.forEach((count, k) => {
          const R = r0 + k * gap;
          const speed = 0.9 / (k + 1);
          for (let j = 0; j < count; j++) {
            const th = (j / count) * Math.PI * 2 + time * speed + k * 0.6;
            const x = cx + R * Math.cos(th), y = cy + R * Math.sin(th);
            ctx.fillStyle = 'rgba(14,165,233,0.25)';
            ctx.beginPath(); ctx.arc(x, y, pr * 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0ea5e9';
            ctx.beginPath(); ctx.arc(x, y, pr * 0.95, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#198754';
          ctx.font = `700 ${Math.max(11, m / 36)}px Inter, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(String(count), cx + R * Math.cos(-0.8) + 6, cy + R * Math.sin(-0.8) - 4);
        });
      }

      this._loop = loop(dt => draw(dt));

      $$('.stepper button', panel).forEach(b => {
        b.addEventListener('click', () => {
          const k = b.dataset.k;
          state[k] = clamp(state[k] + Number(b.dataset.d), LIMIT[k][0], LIMIT[k][1]);
          render();
        });
      });
      $('#atom-neutral').addEventListener('click', () => {
        state.e = state.p;
        state.n = ELEMENTS[state.p - 1][2];
        render();
      });
      $('#atom-random').addEventListener('click', () => {
        state.p = rand(1, 20);
        state.n = ELEMENTS[state.p - 1][2];
        state.e = state.p;
        render();
      });
      render();
    },
    start() { this._loop && this._loop.start(); },
    stop() { this._loop && this._loop.stop(); }
  });
})();
