/* The whole suite, in parallel: node run.js [-j 6] [--retry] [--seed N|random] [t5_ui t10_coop ...]
   Each test runs in its own node + Chrome; its output goes to logs/<name>.log. A test fails when it exits non-zero,
   prints a FAIL line, a non-zero FAILED count or a page error. With --retry a failed test runs once more on its
   own: passing then marks it FLAKY (it still needs fixing, but it is not a hard failure). Exit code 1 if any fail. */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
let jobs = Math.max(2, Math.min(6, Math.floor(require('os').cpus().length / 3)));
let retry = false, seed = null;
const names = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-j') jobs = +args[++i];
  else if (args[i] === '--retry') retry = true;
  else if (args[i] === '--seed') seed = args[++i];
  else names.push(args[i].replace(/\.js$/, ''));
}
const all = fs.readdirSync(__dirname).filter((f) => /^(t\d+_|test_).*\.js$/.test(f)).map((f) => f.replace(/\.js$/, ''));
const num = (n) => (/^t(\d+)_/.exec(n) || [0, 1000])[1] * 1;
const list = (names.length ? names : all).sort((a, b) => num(a) - num(b) || a.localeCompare(b));
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(LOGS, { recursive: true });

function verdict(code, out) {
  const lines = out.split(/\r?\n/);
  const bad = lines.filter((l) => /^FAIL[: ]/.test(l) || /^FAILED: [1-9]/.test(l) || /^\d+ FAILED/.test(l) || /^FAILED$/.test(l) || /PAGEERROR/.test(l));
  return { ok: code === 0 && !bad.length, bad, code };
}

function run(name) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const env = Object.assign({}, process.env);
    if (seed !== null) env.CHAOS_SEED = seed;
    const ch = spawn(process.execPath, [name + '.js'], { cwd: __dirname, env });
    let out = '';
    ch.stdout.on('data', (d) => (out += d));
    ch.stderr.on('data', (d) => (out += d));
    const kill = setTimeout(() => { out += '\nFAIL timed out after 25 min'; ch.kill(); }, 25 * 60 * 1000);
    ch.on('close', (code) => {
      clearTimeout(kill);
      fs.writeFileSync(path.join(LOGS, name + '.log'), out);
      const s = /^seed (\S+)/m.exec(out);
      resolve(Object.assign(verdict(code, out), { name, secs: Math.round((Date.now() - t0) / 1000), seed: s ? s[1] : '-' }));
    });
  });
}

(async () => {
  const t0 = Date.now();
  console.log(`${list.length} tests, ${jobs} at a time, logs in tests/logs/`);
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const r = await run(list[next++]);
      results.push(r);
      console.log(`${r.ok ? 'pass' : 'FAIL'}  ${r.name.padEnd(20)} ${String(r.secs).padStart(4)}s` + (r.ok ? '' : `  exit=${r.code}  ${(r.bad[0] || '').slice(0, 110)}`));
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, worker));
  // failures once more, one at a time: passing alone means flaky (or disturbed by the parallel load)
  const flaky = [];
  if (retry) for (const r of results.filter((q) => !q.ok)) {
    const again = await run(r.name);
    if (again.ok) { flaky.push(r.name); r.ok = true; r.flaky = true; }
    console.log(`retry ${again.ok ? 'pass' : 'FAIL'}  ${r.name}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} passed in ${Math.round((Date.now() - t0) / 1000)} s` + (flaky.length ? `; flaky: ${flaky.join(', ')}` : ''));
  for (const r of failed) console.log(`  FAIL ${r.name} (seed ${r.seed}): logs/${r.name}.log\n    ` + r.bad.slice(0, 4).map((l) => l.slice(0, 150)).join('\n    '));
  process.exit(failed.length ? 1 : 0);
})();
