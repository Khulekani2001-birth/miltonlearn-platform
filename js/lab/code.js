/* MiltonLearn Learning Lab: Python challenges.
   Student code runs in Pyodide inside a Web Worker, so an infinite loop can be stopped by
   terminating the worker instead of freezing the page. */
(function () {
  'use strict';
  const { $, $$, el, store } = Lab;

  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const TIME_LIMIT_MS = 6000;

  const HARNESS = String.raw`
import json, math, copy, traceback

def __fmt(e):
    frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == '<your code>']
    where = f" on line {frames[-1].lineno}" if frames else ""
    return f"{type(e).__name__}{where}: {e}"

def __same(got, exp):
    if isinstance(exp, bool) or isinstance(got, bool):
        return type(got) is bool and type(exp) is bool and got == exp
    if isinstance(exp, (int, float)) and isinstance(got, (int, float)):
        return math.isclose(got, exp, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(exp, list) and isinstance(got, list):
        return len(got) == len(exp) and all(__same(g, x) for g, x in zip(got, exp))
    return got == exp

def __run(code, tests_json, fn, inputs_json):
    inputs = json.loads(inputs_json)
    def fake_input(prompt=''):
        print(prompt, end='')
        if not inputs:
            raise EOFError('input() was called but there is no more program input. Type values in the "Program input" box.')
        value = inputs.pop(0)
        print(value)
        return value
    ns = {'__name__': '__main__', 'input': fake_input}
    result = {'error': None, 'tests': []}
    try:
        exec(compile(code, '<your code>', 'exec'), ns)
    except SyntaxError as e:
        result['error'] = f"SyntaxError on line {e.lineno}: {e.msg}"
        return json.dumps(result)
    except BaseException as e:
        result['error'] = __fmt(e)
        return json.dumps(result)
    tests = json.loads(tests_json)
    if tests:
        f = ns.get(fn)
        if not callable(f):
            result['error'] = f"Your code needs a function called {fn}(). Check the spelling of the def line."
            return json.dumps(result)
        for t in tests:
            exp = t['expected']
            try:
                got = f(*copy.deepcopy(t['args']))
                result['tests'].append({'ok': __same(got, exp), 'got': repr(got), 'exp': repr(exp)})
            except BaseException as e:
                result['tests'].append({'ok': False, 'got': None, 'exp': repr(exp), 'error': __fmt(e)})
    return json.dumps(result)
`;

  const WORKER_SRC = `
let py = null, boot = null;
self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    boot = (async () => {
      importScripts('${PYODIDE}pyodide.js');
      py = await loadPyodide({ indexURL: '${PYODIDE}' });
      py.runPython(msg.harness);
      self.postMessage({ type: 'ready' });
    })().catch(e => self.postMessage({ type: 'fatal', message: String(e) }));
    return;
  }
  await boot;
  if (!py) return;
  const out = [];
  py.setStdout({ batched: s => out.push(s) });
  py.setStderr({ batched: s => out.push(s) });
  try {
    const res = py.globals.get('__run')(msg.code, JSON.stringify(msg.tests), msg.fn || '', JSON.stringify(msg.inputs));
    self.postMessage({ type: 'result', id: msg.id, result: JSON.parse(res), stdout: out.join('\\n') });
  } catch (e) {
    self.postMessage({ type: 'result', id: msg.id, result: { error: String(e), tests: [] }, stdout: out.join('\\n') });
  }
};`;

  const CHALLENGES = [
    {
      id: 'sandbox', title: 'Sandbox', diff: 'easy', sandbox: true,
      brief: 'Free play: write any Python you like and press <strong>Run</strong>. Use the <em>Program input</em> box below to give values to <code>input()</code>.',
      starter: '# Sandbox: write any Python you like!\nname = input("What is your name? ")\nprint("Hello,", name)\n\ntotal = 0\nfor i in range(1, 11):\n    total = total + i\nprint("1 + 2 + ... + 10 =", total)\n',
      stdin: 'Thandi'
    },
    {
      id: 'total', title: 'Totalling', diff: 'easy', fn: 'total', banned: ['sum('],
      brief: 'Write a function <code>total(numbers)</code> that returns the total of all the numbers in a list. Use a loop and a running total, <strong>not</strong> the built-in <code>sum()</code>.',
      example: 'total([4, 7, 1])  →  12\ntotal([])         →  0',
      starter: 'def total(numbers):\n    # Start a running total at 0, then add each number\n    \n    return 0\n',
      hint: 'Set result = 0 before the loop. Inside "for n in numbers:" do result = result + n. Return result after the loop.',
      tests: [[[[4, 7, 1]], 12], [[[]], 0], [[[10]], 10], [[[-5, 10, 2.5]], 7.5], [[[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], 55]]
    },
    {
      id: 'vowels', title: 'Count the vowels', diff: 'easy', fn: 'count_vowels',
      brief: 'Write <code>count_vowels(text)</code> that returns how many vowels (a, e, i, o, u) are in <code>text</code>. Upper-case vowels count too.',
      example: 'count_vowels("MiltonLearn")  →  4',
      starter: 'def count_vowels(text):\n    count = 0\n    \n    return count\n',
      hint: 'Loop over each character. Use text.lower() so "A" and "a" are treated the same, then check: if ch in "aeiou".',
      tests: [[['MiltonLearn'], 4], [['rhythm'], 0], [['AEIOU'], 5], [[''], 0], [['Computer Science'], 6]]
    },
    {
      id: 'grade', title: 'Grade boundaries', diff: 'easy', fn: 'grade',
      brief: 'Write <code>grade(mark)</code> that returns a grade: <strong>A</strong> for 80+, <strong>B</strong> for 70+, <strong>C</strong> for 60+, <strong>D</strong> for 50+ and <strong>U</strong> otherwise. Marks outside 0–100 should return <code>"Invalid"</code> (a range check).',
      example: 'grade(73)   →  "B"\ngrade(105)  →  "Invalid"',
      starter: 'def grade(mark):\n    # Range check first!\n    \n    return "U"\n',
      hint: 'First: if mark < 0 or mark > 100: return "Invalid". Then use if / elif / else from the highest grade downwards.',
      tests: [[[73], 'B'], [[80], 'A'], [[100], 'A'], [[59], 'D'], [[60], 'C'], [[12], 'U'], [[0], 'U'], [[105], 'Invalid'], [[-3], 'Invalid']]
    },
    {
      id: 'passes', title: 'Counting passes', diff: 'easy', fn: 'count_passes',
      brief: 'Write <code>count_passes(marks, pass_mark)</code> that returns how many marks are <strong>greater than or equal to</strong> the pass mark.',
      example: 'count_passes([45, 67, 50, 32], 50)  →  2',
      starter: 'def count_passes(marks, pass_mark):\n    \n    return 0\n',
      hint: 'Start a counter at 0. Loop through marks and add 1 to the counter whenever mark >= pass_mark.',
      tests: [[[[45, 67, 50, 32], 50], 2], [[[], 40], 0], [[[90, 91, 92], 50], 3], [[[10, 20], 50], 0], [[[50, 49, 51], 50], 2]]
    },
    {
      id: 'highest', title: 'Find the highest', diff: 'easy', fn: 'highest', banned: ['max(', 'sorted(', '.sort('],
      brief: 'Write <code>highest(values)</code> that returns the largest value in a non-empty list, <strong>without</strong> using <code>max()</code> or sorting.',
      example: 'highest([3, 19, 7])  →  19',
      starter: 'def highest(values):\n    # Assume the first value is the highest so far\n    \n    return values[0]\n',
      hint: 'Set best = values[0]. Loop through the rest: if v > best then best = v. Do not start best at 0: what if every value is negative?',
      tests: [[[[3, 19, 7]], 19], [[[42]], 42], [[[-8, -3, -12]], -3], [[[5, 5, 5]], 5], [[[1, 2, 3, 100, 4]], 100]]
    },
    {
      id: 'average', title: 'Average to 1 d.p.', diff: 'medium', fn: 'average',
      brief: 'Write <code>average(values)</code> that returns the mean of a list rounded to <strong>1 decimal place</strong>. If the list is empty, return <code>0</code> instead of crashing.',
      example: 'average([2, 3, 5])  →  3.3\naverage([])         →  0',
      starter: 'def average(values):\n    \n    return 0\n',
      hint: 'Check "if len(values) == 0: return 0" first. Then total the values, divide by len(values) and use round(answer, 1).',
      tests: [[[[2, 3, 5]], 3.3], [[[]], 0], [[[10]], 10], [[[1, 2]], 1.5], [[[70, 85, 91, 66]], 78.0]]
    },
    {
      id: 'search', title: 'Linear search', diff: 'medium', fn: 'linear_search', banned: ['.index(', '.find('],
      brief: 'Write <code>linear_search(items, target)</code> that returns the <strong>index</strong> of the first item equal to <code>target</code>, or <code>-1</code> if it is not there. Check each item in turn; do not use <code>.index()</code>.',
      example: 'linear_search(["cat", "dog", "owl"], "dog")  →  1\nlinear_search([4, 8], 5)                     →  -1',
      starter: 'def linear_search(items, target):\n    \n    return -1\n',
      hint: 'Use "for i in range(len(items)):" and return i as soon as items[i] == target. Only return -1 after the loop has finished.',
      tests: [[[['cat', 'dog', 'owl'], 'dog'], 1], [[[4, 8], 5], -1], [[[], 3], -1], [[[7, 7, 7], 7], 0], [[[1, 2, 3, 4, 5, 6], 6], 5]]
    },
    {
      id: 'password', title: 'Password validation', diff: 'medium', fn: 'valid_password',
      brief: 'Write <code>valid_password(pw)</code> that returns <code>True</code> only if the password is <strong>at least 8 characters</strong>, contains <strong>at least one digit</strong> and <strong>at least one upper-case letter</strong>. Otherwise return <code>False</code>.',
      example: 'valid_password("Secret123")  →  True\nvalid_password("secret123")  →  False',
      starter: 'def valid_password(pw):\n    has_digit = False\n    has_upper = False\n    \n    return False\n',
      hint: 'Loop over each character: ch.isdigit() and ch.isupper() tell you what it is. At the end, return len(pw) >= 8 and has_digit and has_upper.',
      tests: [[['Secret123'], true], [['secret123'], false], [['SECRETPASS'], false], [['Ab1'], false], [['12345678A'], true], [[''], false], [['Milton2025'], true]]
    },
    {
      id: 'binary', title: 'Denary to binary', diff: 'medium', fn: 'to_binary', banned: ['bin(', 'format(', ':08b', ':b}'],
      brief: 'Write <code>to_binary(n)</code> that converts a denary number from 0 to 255 into an <strong>8-character</strong> binary string, without <code>bin()</code> or <code>format()</code>.',
      example: 'to_binary(5)    →  "00000101"\nto_binary(200)  →  "11001000"',
      starter: 'def to_binary(n):\n    result = ""\n    \n    return result\n',
      hint: 'Repeat 8 times: the remainder n % 2 is the next bit from the right, so do result = str(n % 2) + result, then n = n // 2.',
      tests: [[[5], '00000101'], [[200], '11001000'], [[0], '00000000'], [[255], '11111111'], [[128], '10000000'], [[77], '01001101']]
    },
    {
      id: 'bubble', title: 'Bubble sort', diff: 'hard', fn: 'bubble_sort', banned: ['sorted(', '.sort('],
      brief: 'Write <code>bubble_sort(items)</code> that sorts a list into <strong>ascending</strong> order using a bubble sort and returns it. No <code>sorted()</code> or <code>.sort()</code>! Try the <a href="#cs-algo">Algorithm Visualiser</a> first.',
      example: 'bubble_sort([5, 1, 4, 2])  →  [1, 2, 4, 5]',
      starter: 'def bubble_sort(items):\n    n = len(items)\n    \n    return items\n',
      hint: 'Use a loop that repeats while a swap happened. Inside, "for i in range(n - 1):" compare items[i] and items[i + 1], and swap them with a temp variable if they are in the wrong order.',
      tests: [[[[5, 1, 4, 2]], [1, 2, 4, 5]], [[[]], []], [[[1]], [1]], [[[3, 3, 1]], [1, 3, 3]], [[[9, 8, 7, 6, 5, 4, 3, 2, 1]], [1, 2, 3, 4, 5, 6, 7, 8, 9]], [[[-2, 10, 0, -7]], [-7, -2, 0, 10]]]
    }
  ];

  function pyRepr(v) {
    if (Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- Python runner (worker wrapper) ---------- */
  function createRunner(onStatus) {
    let worker = null, ready = null, nextId = 1;
    const pending = new Map();

    function spawn() {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      worker = new Worker(url);
      URL.revokeObjectURL(url);
      onStatus('loading', 'Loading Python (first time takes a few seconds)…');
      ready = new Promise((resolve, reject) => {
        worker.onmessage = ev => {
          const m = ev.data;
          if (m.type === 'ready') { onStatus('ready', 'Python 3 ready'); resolve(); }
          else if (m.type === 'fatal') { onStatus('', 'Could not load Python. Check your internet connection.'); reject(new Error(m.message)); }
          else if (m.type === 'result' && pending.has(m.id)) {
            const p = pending.get(m.id);
            pending.delete(m.id);
            clearTimeout(p.timer);
            p.resolve(m);
          }
        };
        worker.onerror = () => { onStatus('', 'Could not start Python in this browser.'); reject(new Error('worker error')); };
      });
      worker.postMessage({ type: 'init', harness: HARNESS });
    }

    function kill() {
      if (worker) worker.terminate();
      worker = null;
      ready = null;
    }

    async function run(payload) {
      if (!worker) spawn();
      try { await ready; } catch (e) { kill(); throw e; }
      return new Promise(resolve => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          kill();
          onStatus('', 'Python was restarted');
          resolve({ timeout: true });
        }, TIME_LIMIT_MS);
        pending.set(id, { resolve, timer });
        worker.postMessage({ ...payload, id });
      });
    }

    return { run, warm() { if (!worker) spawn(); } };
  }

  Lab.register('cs-code', {
    init() {
      const list = $('#code-list');
      const brief = $('#code-brief');
      const editor = $('#code-editor');
      const gutter = $('#code-gutter');
      const consoleEl = $('#code-console');
      const results = $('#code-results');
      const stdin = $('#code-stdin');
      const statusEl = $('#py-status');
      const runBtn = $('#code-run'), testBtn = $('#code-test');
      const solved = new Set(store.get('solved', []));
      let current = null;
      let busy = false;

      const runner = createRunner((state, text) => {
        statusEl.className = 'py-status ' + state;
        $('.txt', statusEl).textContent = text;
      });

      function renderList() {
        list.innerHTML = '';
        const done = CHALLENGES.filter(c => !c.sandbox && solved.has(c.id)).length;
        el('div', { class: 'small fw-semibold text-muted px-1 align-self-center text-nowrap', html: `<i class="bi bi-trophy-fill text-warning me-1"></i>${done} / ${CHALLENGES.length - 1} solved` }, list);
        CHALLENGES.forEach((c, i) => {
          const item = el('button', { type: 'button', class: 'challenge-item' + (current === c ? ' active' : '') + (solved.has(c.id) ? ' solved' : '') }, list);
          el('span', { class: 'ci-num', html: c.sandbox ? '<i class="bi bi-terminal"></i>' : (solved.has(c.id) ? '<i class="bi bi-check-lg"></i>' : i) }, item);
          const txt = el('span', {}, item);
          el('div', { class: 'ci-title', text: c.title }, txt);
          el('div', { class: 'ci-meta', html: c.sandbox ? 'Free play' : `<span class="diff ${c.diff}">${c.diff}</span>` }, txt);
          item.addEventListener('click', () => select(c));
        });
      }

      function select(c) {
        if (current) store.set('code:' + current.id, editor.value);
        current = c;
        brief.innerHTML = `<h4>${c.title} ${c.sandbox ? '' : `<span class="diff ${c.diff}">${c.diff}</span>`}</h4><p class="mb-0">${c.brief}</p>` +
          (c.example ? `<pre>${escapeHtml(c.example)}</pre>` : '');
        editor.value = store.get('code:' + c.id, c.starter);
        stdin.value = c.stdin || '';
        $('#code-stdin-wrap').open = !!c.sandbox;
        testBtn.hidden = !!c.sandbox;
        $('#code-hint').hidden = !c.hint;
        results.innerHTML = '';
        consoleEl.innerHTML = '<span class="muted">Output appears here.</span>';
        updateGutter();
        renderList();
      }

      function updateGutter() {
        const n = editor.value.split('\n').length;
        let s = '';
        for (let i = 1; i <= n; i++) s += i + '\n';
        gutter.textContent = s;
        gutter.scrollTop = editor.scrollTop;
      }

      /* Editor niceties: tab indents, Enter keeps indentation, Ctrl+Enter runs. */
      function insert(text) {
        editor.focus();
        if (!document.execCommand || !document.execCommand('insertText', false, text)) {
          editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
        }
        updateGutter();
      }
      editor.addEventListener('keydown', e => {
        const { selectionStart: s, selectionEnd: end, value } = editor;
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        const before = value.slice(lineStart, s);
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(false); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) {
            const strip = (value.slice(lineStart).match(/^ {1,4}/) || [''])[0].length;
            if (strip) {
              editor.setSelectionRange(lineStart, lineStart + strip);
              insert('');
              editor.setSelectionRange(Math.max(lineStart, s - strip), Math.max(lineStart, end - strip));
            }
          } else insert('    ');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          let indent = (before.match(/^\s*/) || [''])[0];
          if (/:\s*(#.*)?$/.test(before)) indent += '    ';
          insert('\n' + indent);
          return;
        }
        if (e.key === 'Backspace' && s === end && before.length && /^ +$/.test(before) && before.length % 4 === 0) {
          e.preventDefault();
          editor.setSelectionRange(s - 4, s);
          insert('');
        }
      });
      editor.addEventListener('input', () => { updateGutter(); if (current) store.set('code:' + current.id, editor.value); });
      editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
      editor.addEventListener('focus', () => runner.warm(), { once: true });

      function showOutput(stdout, error, timeout) {
        let html = stdout ? escapeHtml(stdout) : '';
        if (timeout) html += `${html ? '\n' : ''}<span class="err">⏱ Time limit exceeded (${TIME_LIMIT_MS / 1000}s). Is there an infinite loop? Check that your loop condition eventually becomes False.</span>`;
        else if (error) html += `${html ? '\n' : ''}<span class="err">✘ ${escapeHtml(error)}</span>`;
        consoleEl.innerHTML = html || '<span class="muted">(no output; your program did not print anything)</span>';
      }

      function usesBanned(code) {
        if (!current.banned) return null;
        const stripped = code.split('\n').map(l => l.replace(/#.*$/, '')).join('\n');
        return current.banned.find(b => stripped.includes(b)) || null;
      }

      async function runCode(withTests) {
        if (busy || !current) return;
        busy = true;
        runBtn.disabled = testBtn.disabled = true;
        results.innerHTML = '';
        consoleEl.innerHTML = '<span class="muted">Running…</span>';
        const tests = withTests ? current.tests.map(([args, expected]) => ({ args, expected })) : [];
        const inputs = stdin.value === '' ? [] : stdin.value.split('\n');
        try {
          const res = await runner.run({ type: 'run', code: editor.value, tests, fn: current.fn, inputs });
          if (res.timeout) { showOutput('', null, true); return; }
          const { result, stdout } = res;
          showOutput(stdout, result.error, false);
          if (withTests && !result.error) renderResults(tests, result.tests);
        } catch (e) {
          consoleEl.innerHTML = '<span class="err">Python could not be loaded. It needs an internet connection the first time.</span>';
        } finally {
          busy = false;
          runBtn.disabled = testBtn.disabled = false;
        }
      }

      function renderResults(tests, outcomes) {
        results.innerHTML = '';
        const call = t => `${current.fn}(${t.args.map(pyRepr).join(', ')})`;
        let passed = 0;
        outcomes.forEach((o, i) => {
          if (o.ok) passed++;
          const row = el('div', { class: 'test-row ' + (o.ok ? 'pass' : 'fail') }, results);
          el('i', { class: 'bi ' + (o.ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill') }, row);
          el('div', {
            html: `<code>${escapeHtml(call(tests[i]))}</code><br><small>expected <code>${escapeHtml(o.exp)}</code>` +
              (o.error ? `, but got an error: <code>${escapeHtml(o.error)}</code>` : `, got <code>${escapeHtml(o.got)}</code>`) + '</small>'
          }, row);
        });
        const banned = usesBanned(editor.value);
        if (passed === outcomes.length && banned) {
          el('div', { class: 'test-row fail', html: `<i class="bi bi-exclamation-triangle-fill"></i><div>All tests pass, but this challenge asks you not to use <code>${escapeHtml(banned)}</code>. Write the algorithm yourself to complete it!</div>` }, results);
        } else if (passed === outcomes.length) {
          solved.add(current.id);
          store.set('solved', [...solved]);
          el('div', { class: 'solved-banner', html: `<i class="bi bi-trophy-fill"></i>All ${passed} tests passed. Challenge complete!` }, results);
          renderList();
        } else {
          el('div', { class: 'small fw-semibold text-muted', text: `${passed} of ${outcomes.length} tests passed. Keep going!` }, results);
        }
      }

      runBtn.addEventListener('click', () => runCode(false));
      testBtn.addEventListener('click', () => runCode(true));
      $('#code-reset').addEventListener('click', () => {
        if (!current || !confirm('Reset this challenge to the starting code?')) return;
        editor.value = current.starter;
        store.set('code:' + current.id, editor.value);
        updateGutter();
      });
      $('#code-hint').addEventListener('click', () => {
        if (!current || !current.hint) return;
        consoleEl.innerHTML = `<span style="color:#fde68a">💡 Hint: ${escapeHtml(current.hint)}</span>`;
      });
      select(CHALLENGES[1]);
    }
  });
})();
