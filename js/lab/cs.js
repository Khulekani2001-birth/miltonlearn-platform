/* MiltonLearn Learning Lab: Computer Science tools (binary, logic gates, algorithms, networks) */
(function () {
  'use strict';
  const { $, $$, el, svgEl, seg, range, clamp, lerp, rand, pick, loop } = Lab;

  /* ======================================================
     Binary & hex
     ====================================================== */
  const PV = [128, 64, 32, 16, 8, 4, 2, 1];

  function bitRow(container, { onToggle, readonly = false, placeValues = true } = {}) {
    container.innerHTML = '';
    const cells = PV.map((pv, i) => {
      const col = el('div', { class: 'bit-col' + (i === 4 ? ' nibble-gap' : '') }, container);
      const label = placeValues ? el('span', { class: 'pv', text: pv }, col) : null;
      const btn = el('button', { class: 'bit' + (readonly ? ' readonly' : ''), type: 'button', 'aria-label': `bit worth ${pv}`, text: '0' }, col);
      if (!readonly && onToggle) btn.addEventListener('click', () => onToggle(i));
      return { col, label, btn };
    });
    return {
      cells,
      set(value, blank = false) {
        cells.forEach((c, i) => {
          const on = !!(value & (1 << (7 - i)));
          c.btn.classList.toggle('on', on && !blank);
          c.btn.textContent = blank ? '' : (on ? '1' : '0');
        });
      },
      setLabels(twos) {
        cells.forEach((c, i) => {
          if (!c.label) return;
          c.label.textContent = i === 0 && twos ? '−128' : PV[i];
          c.label.classList.toggle('neg', i === 0 && twos);
        });
      },
      flash(i) {
        const b = cells[i].btn;
        b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
      }
    };
  }

  const toSigned = v => (v >= 128 ? v - 256 : v);
  const hex2 = v => v.toString(16).toUpperCase().padStart(2, '0');
  const bin8 = v => v.toString(2).padStart(8, '0');

  Lab.register('cs-binary', {
    init() {
      /* --- converter --- */
      let value = 0b01001001;
      const denIn = $('#bin-den-in');
      const msg = $('#bin-shift-msg');
      const row = bitRow($('#bin-bits'), { onToggle: i => { value ^= 1 << (7 - i); msg.textContent = ''; update(); } });
      const signed = seg($('#bin-signed'), () => { row.setLabels(signed.value === 'twos'); update(); });

      function update(fromInput = false) {
        const twos = signed.value === 'twos';
        row.set(value);
        const den = twos ? toSigned(value) : value;
        $('#bin-den').textContent = den;
        $('#bin-hex').textContent = hex2(value);
        const parts = PV.map((pv, i) => (value & (1 << (7 - i)) ? (i === 0 && twos ? '−128' : String(pv)) : null)).filter(Boolean);
        $('#bin-sum').innerHTML = parts.length ? `${parts.join(' + ').replace(/\+ −/g, '− ')} = <strong>${den}</strong>` : 'All bits are 0, so the value is <strong>0</strong>';
        denIn.min = twos ? -128 : 0;
        denIn.max = twos ? 127 : 255;
        if (!fromInput) denIn.value = den;
      }
      denIn.addEventListener('input', () => {
        const twos = signed.value === 'twos';
        const n = parseInt(denIn.value, 10);
        const lo = twos ? -128 : 0, hi = twos ? 127 : 255;
        if (isNaN(n)) return;
        if (n < lo || n > hi) {
          msg.className = 'feedback text-center mt-1 bad';
          msg.textContent = `8 bits can only hold ${lo} to ${hi}${twos ? ' in two\'s complement' : ''}.`;
          return;
        }
        msg.textContent = '';
        value = n & 255;
        update(true);
      });
      $('#bin-shl').addEventListener('click', () => {
        const lost = value & 128;
        value = (value << 1) & 255;
        msg.className = 'feedback text-center mt-1 ' + (lost ? 'bad' : 'ok');
        msg.textContent = lost ? '⚠ A 1 fell off the left end: overflow! The result is no longer value × 2.' : 'Shift left 1 place = multiply by 2.';
        update();
        row.cells.forEach((_, i) => row.flash(i));
      });
      $('#bin-shr').addEventListener('click', () => {
        const lost = value & 1;
        value = value >> 1;
        msg.className = 'feedback text-center mt-1 ' + (lost ? 'bad' : 'ok');
        msg.textContent = lost ? 'Shift right = divide by 2, but the 1 that fell off the right end is lost (the result is rounded down).' : 'Shift right 1 place = divide by 2.';
        update();
        row.cells.forEach((_, i) => row.flash(i));
      });
      $('#bin-not').addEventListener('click', () => {
        value = ~value & 255;
        msg.className = 'feedback text-center mt-1 ok';
        msg.textContent = signed.value === 'twos' ? 'Every bit flipped. Tip: flip the bits and add 1 to make a number negative in two\'s complement.' : 'Every bit flipped (NOT).';
        update();
      });
      $('#bin-clear').addEventListener('click', () => { value = 0; msg.textContent = ''; update(); });
      update();

      /* --- addition --- */
      let a = 0b01011010, b = 0b00110111, adding = null;
      const carryRow = bitRow($('#bin-carry'), { readonly: true, placeValues: false });
      $$('.bit', $('#bin-carry')).forEach(x => x.classList.add('carry'));
      const aRow = bitRow($('#bin-a'), { onToggle: i => { a ^= 1 << (7 - i); resetAdd(); } });
      const bRow = bitRow($('#bin-b'), { onToggle: i => { b ^= 1 << (7 - i); resetAdd(); } });
      const rRow = bitRow($('#bin-r'), { readonly: true, placeValues: false });
      const addMsg = $('#bin-add-msg');
      const RULES = 'Rules: 0+0=0 · 0+1=1 · 1+1=0 carry 1 · 1+1+1=1 carry 1';

      function clearCols() { [carryRow, aRow, bRow, rRow].forEach(r => r.cells.forEach(c => c.col.classList.remove('col-active'))); }
      function resetAdd() {
        clearTimeout(adding); adding = null;
        aRow.set(a); bRow.set(b); rRow.set(0, true); carryRow.set(0, true);
        $('#bin-a-val').textContent = a; $('#bin-b-val').textContent = b; $('#bin-r-val').textContent = '';
        addMsg.textContent = RULES;
        clearCols();
      }
      function runAdd() {
        resetAdd();
        let carry = 0, result = 0, carries = 0, col = 7;
        const step = () => {
          clearCols();
          if (col < 0) {
            $('#bin-r-val').textContent = result;
            addMsg.innerHTML = carry
              ? `<strong class="text-danger">Overflow!</strong> A carry came out of the left-most bit. The true answer ${a} + ${b} = ${a + b} needs 9 bits, so the 8-bit result (${result}) is wrong.`
              : `<strong>Done:</strong> ${a} + ${b} = ${result} ✔ (${bin8(result)}). No overflow.`;
            adding = null;
            return;
          }
          const bitA = (a >> (7 - col)) & 1, bitB = (b >> (7 - col)) & 1;
          const sum = bitA + bitB + carry;
          const out = sum & 1;
          const newCarry = sum >> 1;
          result |= out << (7 - col);
          [carryRow, aRow, bRow, rRow].forEach(r => r.cells[col].col.classList.add('col-active'));
          rRow.cells[col].btn.textContent = out;
          rRow.cells[col].btn.classList.toggle('on', !!out);
          rRow.flash(col);
          if (newCarry && col > 0) {
            carries |= 1 << (7 - (col - 1));
            carryRow.cells[col - 1].btn.textContent = '1';
            carryRow.cells[col - 1].btn.classList.add('on');
          }
          addMsg.textContent = `Column worth ${PV[col]}: ${bitA} + ${bitB}${carry ? ' + 1 (carry)' : ''} = ${sum} → write ${out}${newCarry ? ', carry 1' : ''}`;
          carry = newCarry;
          col--;
          adding = setTimeout(step, 750);
        };
        step();
      }
      $('#bin-add-go').addEventListener('click', runAdd);
      $('#bin-add-rand').addEventListener('click', () => { a = rand(1, 200); b = rand(1, 200); resetAdd(); });
      resetAdd();

      /* --- challenge --- */
      const chBits = $('#bin-ch-bits');
      const chIn = $('#bin-ch-in');
      const chFb = $('#bin-ch-fb');
      let ch = null, chValue = 0, score = 0, streak = 0;
      const chRow = bitRow(chBits, { onToggle: i => { if (ch && ch.kind === 'den2bin') { chValue ^= 1 << (7 - i); chRow.set(chValue); } } });
      const KINDS = {
        den2bin: { label: 'Denary → binary', q: v => `Make ${v} in binary`, bits: 'edit' },
        bin2den: { label: 'Binary → denary', q: () => 'What is this in denary?', bits: 'show', placeholder: 'denary' },
        hex2den: { label: 'Hex → denary', q: v => `What is ${hex2(v)} in denary?`, bits: 'none', placeholder: 'denary' },
        bin2hex: { label: 'Binary → hex', q: () => 'What is this in hexadecimal?', bits: 'show', placeholder: 'hex, e.g. 3F' },
        den2hex: { label: 'Denary → hex', q: v => `What is ${v} in hexadecimal?`, bits: 'none', placeholder: 'hex, e.g. 3F' }
      };
      function newChallenge() {
        const kind = pick(Object.keys(KINDS));
        ch = { kind, target: rand(1, 255) };
        const K = KINDS[kind];
        $('#bin-ch-kind').textContent = K.label;
        $('#bin-ch-q').textContent = K.q(ch.target);
        chBits.hidden = K.bits === 'none';
        chValue = 0;
        chRow.set(K.bits === 'show' ? ch.target : 0);
        chRow.cells.forEach(c => c.btn.classList.toggle('readonly', K.bits !== 'edit'));
        $('#bin-ch-input-wrap').hidden = K.bits === 'edit';
        chIn.value = '';
        chIn.placeholder = K.placeholder || '';
        chFb.textContent = '';
        chFb.className = 'feedback text-center mt-3';
      }
      function checkChallenge() {
        if (!ch) return;
        let ok;
        if (ch.kind === 'den2bin') ok = chValue === ch.target;
        else if (ch.kind === 'bin2hex' || ch.kind === 'den2hex') ok = parseInt(chIn.value.trim().replace(/^0x/i, ''), 16) === ch.target && /^[0-9a-f]{1,2}$/i.test(chIn.value.trim().replace(/^0x/i, ''));
        else ok = parseInt(chIn.value.trim(), 10) === ch.target;
        if (ok) {
          score++; streak++;
          chFb.className = 'feedback text-center mt-3 ok';
          chFb.textContent = `✔ Correct! ${ch.target} = ${bin8(ch.target)} = ${hex2(ch.target)}`;
          setTimeout(newChallenge, 1300);
        } else {
          streak = 0;
          chFb.className = 'feedback text-center mt-3 bad';
          chFb.textContent = ch.kind === 'den2bin' ? `✘ That makes ${chValue}. Start from 128 and work right: does it fit?` : '✘ Not quite. Try again or skip.';
        }
        $('#bin-ch-score').textContent = score;
        $('#bin-ch-streak').textContent = streak;
      }
      $('#bin-ch-check').addEventListener('click', checkChallenge);
      chIn.addEventListener('keydown', e => { if (e.key === 'Enter') checkChallenge(); });
      $('#bin-ch-skip').addEventListener('click', () => {
        streak = 0; $('#bin-ch-streak').textContent = 0;
        chFb.className = 'feedback text-center mt-3';
        chFb.textContent = `Answer: ${ch.target} = ${bin8(ch.target)} = ${hex2(ch.target)}`;
        setTimeout(newChallenge, 1500);
      });

      seg($('#bin-mode'), v => {
        $('#bin-convert').hidden = v !== 'convert';
        $('#bin-add').hidden = v !== 'add';
        $('#bin-challenge').hidden = v !== 'challenge';
        if (v === 'challenge' && !ch) newChallenge();
        if (v !== 'add') resetAdd();
      });
      this._stop = () => { if (adding) resetAdd(); };
    },
    stop() { this._stop && this._stop(); }
  });

  /* ======================================================
     Logic gates
     ====================================================== */
  const GATE = {
    AND: { fn: (a, b) => a & b, out: 60, inset: 0 },
    OR: { fn: (a, b) => a | b, out: 70, inset: 8 },
    NOT: { fn: a => 1 - a, out: 67, inset: 0, unary: true },
    NAND: { fn: (a, b) => 1 - (a & b), out: 72, inset: 0 },
    NOR: { fn: (a, b) => 1 - (a | b), out: 82, inset: 8 },
    XOR: { fn: (a, b) => a ^ b, out: 70, inset: 2 }
  };

  /* Draws a gate with its top-left at the origin of g (70 × 50 units). */
  function drawGate(g, type) {
    const body = { class: 'gate-body' };
    const andPath = 'M0 0 H35 A25 25 0 0 1 35 50 H0 Z';
    const orPath = 'M0 0 Q20 25 0 50 Q50 50 70 25 Q50 0 0 0 Z';
    if (type === 'AND' || type === 'NAND') svgEl('path', { d: andPath, ...body }, g);
    if (type === 'OR' || type === 'NOR' || type === 'XOR') svgEl('path', { d: orPath, ...body }, g);
    if (type === 'XOR') svgEl('path', { d: 'M-8 0 Q12 25 -8 50', fill: 'none', stroke: '#334155', 'stroke-width': 3 }, g);
    if (type === 'NOT') {
      svgEl('path', { d: 'M0 0 L55 25 L0 50 Z', ...body }, g);
      svgEl('circle', { cx: 61, cy: 25, r: 6, ...body }, g);
    }
    if (type === 'NAND') svgEl('circle', { cx: 66, cy: 25, r: 6, ...body }, g);
    if (type === 'NOR') svgEl('circle', { cx: 76, cy: 25, r: 6, ...body }, g);
    svgEl('text', { x: type === 'NOT' ? 20 : 30, y: 29, class: 'gate-label', text: type }, g);
  }

  function gatePorts(type, x, y, s = 1) {
    const G = GATE[type];
    const ins = G.unary ? [[x, y + 25 * s]] : [[x + G.inset * s, y + 15 * s], [x + G.inset * s, y + 35 * s]];
    return { ins, out: [x + G.out * s, y + 25 * s] };
  }

  const CIRCUITS = {
    c1: {
      inputs: [['A', 45], ['B', 115], ['C', 190]],
      gates: [{ id: 'g1', type: 'AND', in: ['A', 'B'], x: 200, y: 55 }, { id: 'g2', type: 'OR', in: ['g1', 'C'], x: 380, y: 130 }],
      expr: 'X = (A AND B) OR C', mid: { g1: 'A AND B' }
    },
    c2: {
      inputs: [['A', 45], ['B', 115], ['C', 205]],
      gates: [{ id: 'g1', type: 'OR', in: ['A', 'B'], x: 200, y: 55 }, { id: 'g2', type: 'NOT', in: ['C'], x: 200, y: 180 }, { id: 'g3', type: 'AND', in: ['g1', 'g2'], x: 380, y: 130 }],
      expr: 'X = (A OR B) AND (NOT C)', mid: { g1: 'A OR B', g2: 'NOT C' }
    },
    c3: {
      inputs: [['A', 40], ['B', 140], ['C', 230]],
      gates: [{ id: 'g1', type: 'AND', in: ['A', 'B'], x: 200, y: 45 }, { id: 'g2', type: 'NAND', in: ['B', 'C'], x: 200, y: 180 }, { id: 'g3', type: 'XOR', in: ['g1', 'g2'], x: 380, y: 115 }],
      expr: 'X = (A AND B) XOR (B NAND C)', mid: { g1: 'A AND B', g2: 'B NAND C' }
    },
    alarm: {
      inputs: [['D', 45, 'door open'], ['S', 115, 'system armed'], ['P', 190, 'panic button']],
      gates: [{ id: 'g1', type: 'AND', in: ['D', 'S'], x: 200, y: 55 }, { id: 'g2', type: 'OR', in: ['g1', 'P'], x: 380, y: 130 }],
      expr: 'X = (D AND S) OR P', mid: { g1: 'D AND S' },
      note: 'The alarm X sounds if the door is opened while the system is armed, or if the panic button is pressed at any time.'
    }
  };

  Lab.register('cs-logic', {
    init() {
      const svg = $('#gate-svg');
      const table = $('#gate-table');
      let mode = 'single', gateType = 'AND', circuitKey = 'c1';
      let inputs = {};

      function wirePath(sx, sy, tx, ty, mx) {
        if (Math.abs(sy - ty) < 0.5) return `M${sx} ${sy} H${tx}`;
        const m = mx !== undefined ? mx : tx - 25;
        return `M${sx} ${sy} H${m} V${ty} H${tx}`;
      }

      function spec() {
        if (mode === 'single') {
          const G = GATE[gateType];
          const names = G.unary ? ['A'] : ['A', 'B'];
          return {
            inputs: names.map((n, i) => [n, G.unary ? 140 : [122, 158][i]]),
            gates: [{ id: 'g1', type: gateType, in: names, x: 250, y: 95, s: 1.8 }],
            expr: G.unary ? 'X = NOT A' : `X = A ${gateType} B`, mid: {}, single: true
          };
        }
        return CIRCUITS[circuitKey];
      }

      function evaluate(sp, vals) {
        const v = { ...vals };
        sp.gates.forEach(g => { v[g.id] = GATE[g.type].fn(...g.in.map(k => v[k])); });
        return v;
      }

      function render() {
        const sp = spec();
        sp.inputs.forEach(([n]) => { if (!(n in inputs)) inputs[n] = 0; });
        const vals = evaluate(sp, inputs);
        const out = vals[sp.gates[sp.gates.length - 1].id];
        svg.innerHTML = '';
        const wires = svgEl('g', {}, svg);
        const ports = {};
        const srcPos = {};
        const swX = sp.single ? 90 : 50;
        sp.inputs.forEach(([n, y]) => { srcPos[n] = [swX + 22, sp.single ? (sp.inputs.length === 1 ? 140 : [95, 185][sp.inputs.findIndex(i => i[0] === n)]) : y]; });
        sp.gates.forEach(g => { ports[g.id] = gatePorts(g.type, g.x, g.y, g.s || 1); srcPos[g.id] = ports[g.id].out; });

        const junctions = {};
        sp.gates.forEach(g => {
          g.in.forEach((src, k) => {
            const [sx, sy] = srcPos[src];
            const [tx, ty] = ports[g.id].ins[k];
            const mx = sp.single ? 190 : (sp.inputs.some(i => i[0] === src) ? 175 : tx - 25);
            svgEl('path', { d: wirePath(sx, sy, tx, ty, mx), class: 'wire' + (vals[src] ? ' on' : '') }, wires);
            junctions[src] = (junctions[src] || 0) + 1;
            if (junctions[src] === 2) svgEl('circle', { cx: mx, cy: sy, r: 5, fill: vals[src] ? '#198754' : '#94a3b8' }, wires);
          });
        });
        const last = sp.gates[sp.gates.length - 1];
        const [ox, oy] = srcPos[last.id];
        const lampX = sp.single ? 520 : 540;
        svgEl('path', { d: `M${ox} ${oy} H${lampX - 24}`, class: 'wire' + (out ? ' on' : '') }, wires);

        sp.gates.forEach(g => {
          const gg = svgEl('g', { transform: `translate(${g.x} ${g.y}) scale(${g.s || 1})` }, svg);
          drawGate(gg, g.type);
          if (!sp.single) svgEl('text', { x: g.x + 30, y: g.y - 8, text: vals[g.id], 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, fill: vals[g.id] ? '#198754' : '#94a3b8', 'font-family': 'JetBrains Mono, monospace' }, svg);
        });

        sp.inputs.forEach(([n, , desc]) => {
          const [x, y] = [swX, srcPos[n][1]];
          const g = svgEl('g', { class: 'in-switch' + (inputs[n] ? ' on' : ''), transform: `translate(${x} ${y})`, role: 'button', tabindex: 0, 'aria-label': `Toggle input ${n}` }, svg);
          svgEl('circle', { r: 20 }, g);
          svgEl('text', { text: n }, g);
          svgEl('text', { x: -34, y: 0, text: inputs[n], style: `fill:${inputs[n] ? '#198754' : '#94a3b8'};font-size:14px` }, g);
          if (desc) svgEl('text', { x: 0, y: 32, text: desc, style: 'font-size:10px;font-weight:600;fill:#64748b' }, g);
          const toggle = () => { inputs[n] = 1 - inputs[n]; render(); };
          g.addEventListener('click', toggle);
          g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        });

        svgEl('circle', { cx: lampX, cy: oy, r: 24, class: 'lamp' + (out ? ' on' : '') }, svg);
        svgEl('text', { x: lampX, y: oy + 44, text: `X = ${out}`, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: out ? '#198754' : '#64748b', 'font-family': 'Inter, sans-serif' }, svg);

        $('#gate-expr').textContent = sp.expr;
        $('#gate-note').textContent = sp.note || (mode === 'single' ? GATE_NOTES[gateType] : 'The small numbers above each gate show its current output, the same as the working columns in the table.');
        renderTable(sp);
      }

      function renderTable(sp) {
        const names = sp.inputs.map(i => i[0]);
        const mids = sp.gates.filter(g => sp.mid[g.id]).map(g => g.id);
        const lastId = sp.gates[sp.gates.length - 1].id;
        let html = '<thead><tr>' + names.map(n => `<th>${n}</th>`).join('') + mids.map(m => `<th class="mid">${sp.mid[m]}</th>`).join('') + '<th>X</th></tr></thead><tbody>';
        const rows = 1 << names.length;
        let current = 0;
        names.forEach((n, i) => { if (inputs[n]) current |= 1 << (names.length - 1 - i); });
        for (let r = 0; r < rows; r++) {
          const vals = {};
          names.forEach((n, i) => { vals[n] = (r >> (names.length - 1 - i)) & 1; });
          const v = evaluate(sp, vals);
          html += `<tr data-row="${r}" class="${r === current ? 'current' : ''}">` + names.map(n => `<td>${vals[n]}</td>`).join('') + mids.map(m => `<td>${v[m]}</td>`).join('') + `<td class="out">${v[lastId]}</td></tr>`;
        }
        table.innerHTML = html + '</tbody>';
        $$('tr[data-row]', table).forEach(tr => tr.addEventListener('click', () => {
          const r = Number(tr.dataset.row);
          names.forEach((n, i) => { inputs[n] = (r >> (names.length - 1 - i)) & 1; });
          render();
        }));
      }

      const GATE_NOTES = {
        AND: 'Output is 1 only when both inputs are 1.',
        OR: 'Output is 1 when at least one input is 1.',
        NOT: 'The output is the opposite of the input (an inverter).',
        NAND: 'NOT AND: the opposite of AND. Output is 0 only when both inputs are 1.',
        NOR: 'NOT OR: the opposite of OR. Output is 1 only when both inputs are 0.',
        XOR: 'Exclusive OR: output is 1 when the inputs are different.'
      };

      seg($('#gate-mode'), v => {
        mode = v;
        $('#gate-type-group').hidden = v !== 'single';
        $('#gate-circuit-group').hidden = v !== 'circuit';
        inputs = {};
        render();
      });
      seg($('#gate-type'), v => { gateType = v; render(); });
      seg($('#gate-circuit'), v => { circuitKey = v; inputs = {}; render(); });
      render();
    }
  });

  /* ======================================================
     Algorithm visualiser
     ====================================================== */
  const PSEUDO = {
    bubble: [
      'Last ← LENGTH(A) - 1', 'REPEAT', '    Swapped ← FALSE', '    FOR i ← 0 TO Last - 1', '        IF A[i] > A[i + 1] THEN',
      '            Temp ← A[i]', '            A[i] ← A[i + 1]', '            A[i + 1] ← Temp', '            Swapped ← TRUE', '        ENDIF',
      '    NEXT i', '    Last ← Last - 1', 'UNTIL NOT Swapped OR Last = 0'
    ],
    insertion: [
      'FOR i ← 1 TO LENGTH(A) - 1', '    Key ← A[i]', '    j ← i - 1', '    WHILE j >= 0 AND A[j] > Key', '        A[j + 1] ← A[j]',
      '        j ← j - 1', '    ENDWHILE', '    A[j + 1] ← Key', 'NEXT i'
    ],
    merge: [
      'PROCEDURE MergeSort(A, Low, High)', '    IF Low < High THEN', '        Mid ← (Low + High) DIV 2', '        MergeSort(A, Low, Mid)',
      '        MergeSort(A, Mid + 1, High)', '        Merge(A, Low, Mid, High)', '    ENDIF', 'ENDPROCEDURE'
    ],
    linear: [
      'Found ← FALSE', 'i ← 0', 'WHILE i < LENGTH(A) AND NOT Found', '    IF A[i] = Target THEN', '        Found ← TRUE', '    ELSE',
      '        i ← i + 1', '    ENDIF', 'ENDWHILE', 'IF Found THEN OUTPUT "Found at ", i', 'ELSE OUTPUT "Not found"'
    ],
    binary: [
      'Low ← 0', 'High ← LENGTH(A) - 1', 'Found ← FALSE', 'WHILE Low <= High AND NOT Found', '    Mid ← (Low + High) DIV 2',
      '    IF A[Mid] = Target THEN', '        Found ← TRUE', '    ELSE IF A[Mid] < Target THEN', '        Low ← Mid + 1', '    ELSE',
      '        High ← Mid - 1', '    ENDIF', 'ENDWHILE'
    ]
  };
  const KW = /\b(FOR|TO|NEXT|IF|THEN|ELSE|ENDIF|WHILE|ENDWHILE|REPEAT|UNTIL|AND|OR|NOT|TRUE|FALSE|PROCEDURE|ENDPROCEDURE|DIV|OUTPUT|LENGTH)\b/g;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const ALGOS = {
    *bubble(a, ctx) {
      let last = a.length - 1, swapped;
      yield { line: 0 };
      do {
        swapped = false;
        yield { line: 2, msg: `Start a new pass (checking up to position ${last})` };
        for (let i = 0; i < last; i++) {
          ctx.cmp++;
          yield { line: 4, hl: { [i]: 'compare', [i + 1]: 'compare' }, msg: `Is ${a[i]} > ${a[i + 1]}?` };
          if (a[i] > a[i + 1]) {
            [a[i], a[i + 1]] = [a[i + 1], a[i]];
            ctx.swp++; swapped = true;
            yield { line: [5, 6, 7, 8], hl: { [i]: 'swap', [i + 1]: 'swap' }, msg: `Yes, swap ${a[i + 1]} and ${a[i]}` };
          }
        }
        ctx.sorted.add(last);
        last--;
        yield { line: 11, msg: swapped ? `End of pass: ${a[last + 1]} has bubbled to its final place` : 'A whole pass with no swaps: the list is sorted, so stop early!' };
      } while (swapped && last > 0);
      for (let i = 0; i < a.length; i++) ctx.sorted.add(i);
      yield { line: 12, msg: `Sorted in ${ctx.cmp} comparisons and ${ctx.swp} swaps.`, done: true };
    },
    *insertion(a, ctx) {
      ctx.sorted.add(0);
      for (let i = 1; i < a.length; i++) {
        const key = a[i];
        yield { line: [1, 2], hl: { [i]: 'key' }, msg: `Key = ${key}. Insert it into the sorted part on the left.` };
        let j = i - 1;
        while (j >= 0) {
          ctx.cmp++;
          yield { line: 3, hl: { [j]: 'compare', [j + 1]: 'key' }, msg: `Is ${a[j]} > ${key}?` };
          if (a[j] > key) {
            [a[j], a[j + 1]] = [a[j + 1], a[j]];
            ctx.swp++;
            yield { line: [4, 5], hl: { [j + 1]: 'swap', [j]: 'key' }, msg: `Yes, shift ${a[j + 1]} one place right` };
            j--;
          } else break;
        }
        for (let k = 0; k <= i; k++) ctx.sorted.add(k);
        yield { line: 7, hl: { [j + 1]: 'key' }, msg: `Insert ${key} at position ${j + 1}` };
      }
      yield { line: 8, msg: `Sorted in ${ctx.cmp} comparisons and ${ctx.swp} shifts.`, done: true };
    },
    *merge(a, ctx) {
      function* sort(lo, hi) {
        if (lo >= hi) return;
        const mid = (lo + hi) >> 1;
        yield { line: 2, range: [lo, hi], msg: `Split positions ${lo}–${hi} at ${mid}` };
        yield { line: 3, range: [lo, mid] };
        yield* sort(lo, mid);
        yield { line: 4, range: [mid + 1, hi] };
        yield* sort(mid + 1, hi);
        const left = a.slice(lo, mid + 1), right = a.slice(mid + 1, hi + 1);
        let i = 0, j = 0, k = lo;
        while (i < left.length || j < right.length) {
          let takeLeft;
          if (i < left.length && j < right.length) {
            ctx.cmp++;
            takeLeft = left[i] <= right[j];
            yield { line: 5, range: [lo, hi], hl: { [k]: 'compare' }, msg: `Merge: compare ${left[i]} and ${right[j]}, take ${takeLeft ? left[i] : right[j]}` };
          } else takeLeft = i < left.length;
          a[k] = takeLeft ? left[i++] : right[j++];
          ctx.swp++;
          yield { line: 5, range: [lo, hi], hl: { [k]: 'swap' } };
          k++;
        }
        if (lo === 0 && hi === a.length - 1) for (let x = 0; x < a.length; x++) ctx.sorted.add(x);
        yield { line: 6, range: [lo, hi], msg: `Positions ${lo}–${hi} are now merged in order` };
      }
      yield* sort(0, a.length - 1);
      yield { line: 7, msg: `Sorted in ${ctx.cmp} comparisons and ${ctx.swp} writes.`, done: true };
    },
    *linear(a, ctx) {
      const t = ctx.target;
      yield { line: [0, 1], msg: `Look for ${t}, starting at position 0` };
      for (let i = 0; i < a.length; i++) {
        ctx.cmp++;
        yield { line: 3, hl: { [i]: 'compare' }, ptr: { [i]: 'i' }, msg: `Is A[${i}] = ${t}? (A[${i}] is ${a[i]})` };
        if (a[i] === t) {
          yield { line: [4, 9], hl: { [i]: 'found' }, ptr: { [i]: 'i' }, msg: `Found ${t} at position ${i} after ${ctx.cmp} comparisons.`, done: true };
          return;
        }
        ctx.checked.add(i);
        yield { line: 6, ptr: { [i + 1]: 'i' } };
      }
      yield { line: 10, msg: `${t} is not in the list. We had to check all ${a.length} items.`, done: true };
    },
    *binary(a, ctx) {
      const t = ctx.target;
      let lo = 0, hi = a.length - 1;
      yield { line: [0, 1, 2], ptr: { [lo]: 'Low', [hi]: 'High' }, msg: `Look for ${t}. The list must be sorted for a binary search.` };
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const ptr = { [lo]: 'Low', [hi]: 'High' };
        ptr[mid] = (ptr[mid] ? ptr[mid] + '/' : '') + 'Mid';
        ctx.cmp++;
        yield { line: [4, 5], range: [lo, hi], hl: { [mid]: 'compare' }, ptr, msg: `Mid = (${lo} + ${hi}) DIV 2 = ${mid}. Is A[${mid}] (${a[mid]}) = ${t}?` };
        if (a[mid] === t) {
          yield { line: 6, hl: { [mid]: 'found' }, ptr: { [mid]: 'Mid' }, msg: `Found ${t} at position ${mid} in only ${ctx.cmp} comparisons!`, done: true };
          return;
        }
        if (a[mid] < t) {
          lo = mid + 1;
          yield { line: 8, range: [lo, hi], msg: `${a[mid]} < ${t}, so discard the left half` };
        } else {
          hi = mid - 1;
          yield { line: 10, range: [lo, hi], msg: `${a[mid]} > ${t}, so discard the right half` };
        }
      }
      yield { line: 12, range: [0, -1], msg: `Low > High, so ${t} is not in the list (${ctx.cmp} comparisons).`, done: true };
    }
  };

  Lab.register('cs-algo', {
    init() {
      const bars = $('#algo-bars');
      const pseudo = $('#algo-pseudo');
      const picker = $('#algo-pick');
      const targetIn = $('#algo-target');
      const playBtn = $('#algo-play');
      let data = [], arr = [], gen = null, ctx = null, timer = null, playing = false, done = false, barEls = [];

      const sizeCtl = range($('#algo-size'), $('#algo-size-val'), v => v, () => newData());
      const speedCtl = range($('#algo-speed'), $('#algo-speed-val'), v => v);
      const isSearch = () => picker.value === 'linear' || picker.value === 'binary';

      function newData() {
        const n = sizeCtl.value;
        const pool = [];
        for (let v = 5; v <= 99; v++) pool.push(v);
        data = [];
        for (let i = 0; i < n; i++) data.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        if (isSearch()) targetIn.value = Math.random() < 0.8 ? pick(data) : pick(pool);
        reset();
      }

      function reset() {
        pause();
        arr = data.slice();
        if (picker.value === 'binary') arr.sort((x, y) => x - y);
        ctx = { cmp: 0, swp: 0, sorted: new Set(), checked: new Set(), target: parseInt(targetIn.value, 10) };
        gen = ALGOS[picker.value](arr, ctx);
        done = false;
        bars.innerHTML = '';
        barEls = arr.map(() => el('div', { class: 'algo-bar' }, bars));
        pseudo.innerHTML = PSEUDO[picker.value].map(l => `<div>${esc(l).replace(KW, '<span class="kw">$1</span>')}</div>`).join('');
        $('#algo-target-group').hidden = !isSearch();
        $('#algo-swp-label').textContent = { bubble: 'Swaps', insertion: 'Shifts', merge: 'Writes' }[picker.value] || 'Items checked';
        $('#algo-legend').innerHTML = isSearch()
          ? '<span><i style="background:#f59e0b"></i>Checking</span><span><i style="background:#94a3b8"></i>Checked</span><span><i style="background:#198754"></i>Found</span>'
          : '<span><i style="background:#f59e0b"></i>Comparing</span><span><i style="background:#ef4444"></i>Moving</span><span><i style="background:#0ea5e9"></i>Key</span><span><i style="background:#198754"></i>Sorted</span>';
        $('#algo-n').textContent = arr.length;
        draw({ msg: isSearch() ? `Press Play to search for ${ctx.target}${picker.value === 'binary' ? ' (the list has been sorted first)' : ''}.` : 'Press Play or Step to start.' });
      }

      function draw(step) {
        const max = 100;
        const showLabels = arr.length <= 20;
        const inRange = i => !step.range || (i >= step.range[0] && i <= step.range[1]);
        barEls.forEach((b, i) => {
          b.style.height = (arr[i] / max * 100) + '%';
          let cls = 'algo-bar';
          if (ctx.sorted.has(i)) cls += ' sorted';
          if (ctx.checked.has(i)) cls += ' checked';
          if (step.hl && step.hl[i]) cls += ' ' + step.hl[i];
          if (!inRange(i)) cls += ' dim';
          if (step.ptr && step.ptr[i]) { cls += ' pointer'; b.dataset.ptr = step.ptr[i]; }
          b.className = cls;
          b.innerHTML = showLabels ? `<span>${arr[i]}</span>` : '';
        });
        const lines = step.line === undefined ? [] : [].concat(step.line);
        $$('div', pseudo).forEach((d, i) => d.classList.toggle('hl', lines.includes(i)));
        if (step.msg) $('#algo-msg').textContent = step.msg;
        $('#algo-cmp').textContent = ctx.cmp;
        $('#algo-swp').textContent = isSearch() ? ctx.checked.size : ctx.swp;
      }

      function stepOnce() {
        if (done) return false;
        const r = gen.next();
        if (r.done) { done = true; pause(); return false; }
        draw(r.value);
        if (r.value.done) { done = true; pause(); playBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i>Replay'; }
        return !done;
      }
      function tick() {
        if (!playing) return;
        if (stepOnce()) timer = setTimeout(tick, 900 * Math.pow(0.7, speedCtl.value - 1));
      }
      function pause() {
        playing = false;
        clearTimeout(timer);
        playBtn.innerHTML = '<i class="bi bi-play-fill"></i>Play';
      }
      playBtn.addEventListener('click', () => {
        if (playing) return pause();
        if (done) reset();
        playing = true;
        playBtn.innerHTML = '<i class="bi bi-pause-fill"></i>Pause';
        tick();
      });
      $('#algo-step').addEventListener('click', () => { pause(); if (done) reset(); stepOnce(); });
      $('#algo-new').addEventListener('click', newData);
      picker.addEventListener('change', () => {
        if (isSearch() && !data.includes(parseInt(targetIn.value, 10))) targetIn.value = pick(data);
        reset();
      });
      targetIn.addEventListener('change', reset);
      newData();
      this._pause = pause;
    },
    stop() { this._pause && this._pause(); }
  });

  /* ======================================================
     Packet switching
     ====================================================== */
  const NODES = {
    S: [48, 150], R1: [170, 72], R2: [170, 228], R3: [318, 46], R4: [318, 150], R5: [318, 254],
    R6: [470, 86], R7: [470, 214], D: [592, 150]
  };
  const LINKS = [['S', 'R1'], ['S', 'R2'], ['R1', 'R3'], ['R1', 'R4'], ['R2', 'R4'], ['R2', 'R5'], ['R3', 'R6'], ['R4', 'R6'], ['R4', 'R7'], ['R5', 'R7'], ['R6', 'D'], ['R7', 'D'], ['R1', 'R2'], ['R3', 'R4'], ['R4', 'R5'], ['R6', 'R7']];
  const PKT_COLORS = ['#198754', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899', '#475569'];
  const SRC_IP = '192.168.1.10', DST_IP = '172.16.0.5';

  function forwardHops(node) {
    return LINKS.filter(([a, b]) => (a === node || b === node)).map(([a, b]) => (a === node ? b : a)).filter(n => NODES[n][0] > NODES[node][0] + 10);
  }
  function randomRoute() {
    const route = ['S'];
    while (route[route.length - 1] !== 'D') route.push(pick(forwardHops(route[route.length - 1])));
    return route;
  }
  const linkKey = (a, b) => [a, b].sort().join('-');

  Lab.register('cs-network', {
    init() {
      const svg = $('#net-svg');
      const finalEl = $('#net-final');
      const header = $('#net-header');
      const sizeCtl = range($('#net-size'), $('#net-size-val'), v => `${v} chars`);
      const linkEls = {};
      const routerEls = {};
      let sim = null;

      LINKS.forEach(([a, b]) => {
        linkEls[linkKey(a, b)] = svgEl('line', { x1: NODES[a][0], y1: NODES[a][1], x2: NODES[b][0], y2: NODES[b][1], class: 'link' }, svg);
      });
      Object.entries(NODES).forEach(([id, [x, y]]) => {
        if (id === 'S' || id === 'D') {
          const g = svgEl('g', { transform: `translate(${x} ${y})` }, svg);
          svgEl('rect', { x: -26, y: -24, width: 52, height: 36, rx: 6, fill: '#1e293b' }, g);
          svgEl('rect', { x: -21, y: -19, width: 42, height: 26, rx: 3, fill: id === 'S' ? '#20c997' : '#0ea5e9' }, g);
          svgEl('rect', { x: -10, y: 12, width: 20, height: 6, fill: '#334155' }, g);
          svgEl('rect', { x: -18, y: 18, width: 36, height: 4, rx: 2, fill: '#334155' }, g);
          svgEl('text', { y: 38, class: 'node-label', text: id === 'S' ? 'Sender' : 'Receiver' }, g);
          svgEl('text', { y: 51, class: 'node-label', text: id === 'S' ? SRC_IP : DST_IP, style: 'font-weight:500;font-size:10px' }, g);
        } else {
          const g = svgEl('g', { class: 'node-router', transform: `translate(${x} ${y})` }, svg);
          svgEl('circle', { r: 19 }, g);
          svgEl('path', { d: 'M-9 -3 h14 l-4 -4 M9 3 h-14 l4 4', fill: 'none', stroke: '#334155', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
          svgEl('text', { y: 33, class: 'node-label', text: id }, g);
          routerEls[id] = g;
        }
      });
      const pktLayer = svgEl('g', {}, svg);

      function showHeader(p) {
        if (!p) { header.innerHTML = '<tr><td colspan="2" class="text-muted" style="font-family:Inter">Send a message, then click a packet.</td></tr>'; return; }
        const checksum = [...p.payload].reduce((s, c) => s + c.charCodeAt(0), 0) % 256;
        header.innerHTML = `
          <tr><td>Source IP</td><td>${SRC_IP}</td></tr>
          <tr><td>Destination IP</td><td>${DST_IP}</td></tr>
          <tr><td>Packet number</td><td>${p.seq} of ${p.total}</td></tr>
          <tr><td>Payload</td><td>"${p.payload.replace(/</g, '&lt;')}"</td></tr>
          <tr><td>Checksum (trailer)</td><td>${checksum}</td></tr>
          <tr><td>Route taken</td><td>${p.routeShown ? p.routeShown.join(' → ') : 'in transit…'}</td></tr>`;
      }
      showHeader(null);

      function plan(packet, startTime, allowDrop) {
        const route = randomRoute();
        const segs = [];
        let t = startTime;
        for (let h = 0; h < route.length - 1; h++) {
          const [x1, y1] = NODES[route[h]], [x2, y2] = NODES[route[h + 1]];
          const dur = Math.hypot(x2 - x1, y2 - y1) / (90 + Math.random() * 130);
          segs.push({ a: route[h], b: route[h + 1], t0: t, t1: t + dur });
          t += dur;
          if (h < route.length - 2) t += 0.1 + Math.random() * 0.6;
        }
        const attempt = { route, segs, arrive: t, dropAt: null };
        if (allowDrop) {
          const hop = Math.min(2, segs.length - 1);
          attempt.dropAt = segs[hop - 1].t1;
          attempt.dropNode = segs[hop - 1].b;
        }
        packet.attempts.push(attempt);
        return attempt;
      }

      function send() {
        const text = $('#net-msg').value || 'Hello!';
        const size = sizeCtl.value;
        const packets = [];
        for (let i = 0; i < text.length; i += size) {
          packets.push({ seq: packets.length + 1, payload: text.slice(i, i + size), color: PKT_COLORS[packets.length % PKT_COLORS.length], attempts: [], arrived: false });
        }
        packets.forEach(p => { p.total = packets.length; });
        const dropIdx = $('#net-loss').checked && packets.length > 1 ? rand(0, packets.length - 1) : -1;
        packets.forEach((p, i) => plan(p, i * 0.35, i === dropIdx));
        pktLayer.innerHTML = '';
        packets.forEach(p => {
          p.g = svgEl('g', { class: 'packet', style: 'cursor:pointer', opacity: 0 }, pktLayer);
          svgEl('rect', { x: -15, y: -10, width: 30, height: 20, rx: 5, fill: p.color, stroke: '#fff', 'stroke-width': 2 }, p.g);
          svgEl('text', { text: p.seq }, p.g);
          p.g.addEventListener('click', () => showHeader(p));
        });
        Object.values(linkEls).forEach(l => l.classList.remove('used'));
        $('#net-arrived').innerHTML = '';
        $('#net-reasm').innerHTML = packets.map(p => `<span data-seq="${p.seq}">${p.seq}</span>`).join('');
        finalEl.className = 'feedback mt-2';
        finalEl.textContent = `Sending ${packets.length} packets…`;
        sim = { t: 0, packets, dropIdx, resent: false, done: false };
        showHeader(packets[0]);
        anim.start();
      }

      function positionOf(att, t) {
        if (t < att.segs[0].t0) return null;
        if (att.dropAt !== null && t >= att.dropAt) return null;
        for (const s of att.segs) {
          if (t >= s.t0 && t <= s.t1) {
            const k = (t - s.t0) / (s.t1 - s.t0);
            return { x: lerp(NODES[s.a][0], NODES[s.b][0], k), y: lerp(NODES[s.a][1], NODES[s.b][1], k), link: linkKey(s.a, s.b) };
          }
          if (t < s.t0) return { x: NODES[s.a][0], y: NODES[s.a][1] - 22, wait: s.a };
        }
        return null;
      }

      const anim = loop(dt => {
        if (!sim) return;
        sim.t += dt;
        const t = sim.t;
        const busy = new Set();
        sim.packets.forEach(p => {
          const att = p.attempts[p.attempts.length - 1];
          const pos = positionOf(att, t);
          if (pos) {
            p.g.setAttribute('opacity', 1);
            p.g.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
            if (pos.link) linkEls[pos.link].classList.add('used');
            if (pos.wait) busy.add(pos.wait);
          } else {
            p.g.setAttribute('opacity', 0);
          }
          if (att.dropAt !== null && t >= att.dropAt && !att.dropShown) {
            att.dropShown = true;
            const [x, y] = NODES[att.dropNode];
            const x0 = svgEl('text', { x, y: y - 24, text: '✕', 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: '#dc3545' }, pktLayer);
            setTimeout(() => x0.remove(), 1500);
            finalEl.className = 'feedback mt-2 bad';
            finalEl.textContent = `Packet ${p.seq} was lost at router ${att.dropNode}! The receiver will notice it is missing.`;
          }
          if (!p.arrived && att.dropAt === null && t >= att.arrive) {
            p.arrived = true;
            p.routeShown = att.route.map(n => (n === 'S' ? 'Sender' : n === 'D' ? 'Receiver' : n));
            const chip = el('span', { class: 'packet-chip', style: `background:${p.color}`, text: `#${p.seq}` }, $('#net-arrived'));
            chip.addEventListener('click', () => showHeader(p));
            const slot = $(`#net-reasm [data-seq="${p.seq}"]`);
            slot.textContent = p.payload;
            slot.className = 'filled';
            slot.style.background = p.color;
            slot.style.borderColor = p.color;
          }
        });
        Object.entries(routerEls).forEach(([id, g]) => g.classList.toggle('busy', busy.has(id)));

        const waiting = sim.packets.filter(p => !p.arrived);
        if (sim.dropIdx >= 0 && !sim.resent && waiting.length === 1) {
          const lastArrival = Math.max(...sim.packets.filter(p => p.arrived).map(p => p.attempts[p.attempts.length - 1].arrive), 0);
          if (t > lastArrival + 0.9) {
            const p = sim.packets[sim.dropIdx];
            sim.resent = true;
            finalEl.className = 'feedback mt-2';
            finalEl.textContent = `Timeout: packet ${p.seq} never arrived, so the receiver asks for it to be sent again…`;
            $(`#net-reasm [data-seq="${p.seq}"]`).outerHTML = `<span data-seq="${p.seq}" class="packet-chip missing">${p.seq}?</span>`;
            plan(p, t + 0.6, false);
          }
        }
        if (!waiting.length && !sim.done) {
          sim.done = true;
          const ordered = sim.packets.map(p => p.payload).join('');
          const order = [...$$('#net-arrived .packet-chip')].map(c => c.textContent).join(', ');
          finalEl.className = 'feedback mt-2 ok';
          finalEl.innerHTML = `✔ All ${sim.packets.length} packets arrived (in the order ${order}) and were reassembled: “${ordered.replace(/</g, '&lt;')}”`;
          setTimeout(() => { if (sim && sim.done) anim.stop(); }, 400);
        }
      });

      $('#net-send').addEventListener('click', send);
      $('#net-msg').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      this._anim = anim;
      this._active = () => sim && !sim.done;
    },
    start() { if (this._active && this._active()) this._anim.start(); },
    stop() { this._anim && this._anim.stop(); }
  });
})();
