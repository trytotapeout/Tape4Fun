import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import vm from 'node:vm';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));

async function snapshot(directory, prefix = '') {
  const result = new Map();
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const file = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      for (const item of await snapshot(directory, file)) result.set(...item);
    } else result.set(file, await readFile(path.join(directory, file), 'utf8'));
  }
  return new Map([...result].sort(([a], [b]) => a.localeCompare(b)));
}

function checkLinks(files) {
  for (const [file, html] of files) {
    if (!file.endsWith('.html')) continue;
    for (const [, reference] of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
      const url = new URL(reference, `https://test.invalid/${file}`);
      assert.ok(files.has(decodeURIComponent(url.pathname.slice(1))), `${file} → ${reference}`);
    }
  }
}

function checkRouter(files, base = 'https://test.invalid/', script = 'assets/language.js') {
  const html = files.get('index.html');
  const links = new Map([...html.matchAll(/href="([^"]+)" data-language-link="([^"]+)"/g)]
    .map(([, href, lang]) => [lang, new URL(href, base).href]));
  for (const [saved, browser, expected] of [
    ['en', 'zh-CN', 'en'], ['zh-cn', 'en-US', 'zh-cn'],
    [null, 'zh-CN', 'zh-cn'], ['invalid', 'en-US', 'en'],
  ]) {
    let destination;
    vm.runInNewContext(files.get(script), {
      URL,
      localStorage: { getItem: () => saved },
      navigator: { language: browser },
      document: {
        body: { dataset: { languageRouter: 'true' } },
        querySelector: (selector) => ({ href: links.get(selector.match(/="([^"]+)"/)[1]) }),
      },
      location: { hash: '#section', replace: (url) => { destination = url; } },
    });
    assert.equal(destination, `${links.get(expected)}#section`);
  }
}

function checkLegacyEntries(files) {
  const entry = files.get('index.html');
  const release = entry.match(/\.\/(releases\/[a-f0-9]{64})\//)[1];
  for (const [file, html] of files) {
    if (!/^(en|zh-cn)\/.*\.html$/.test(file)) continue;
    assert.match(html, /http-equiv="refresh"/);
    let destination;
    const redirect = html.match(/<script>(.*?)<\/script>/)[1];
    vm.runInNewContext(redirect, {
      location: { search: '?source=bookmark', hash: '#projects', replace: (url) => { destination = url; } },
    });
    const url = new URL(destination, `https://test.invalid/subsite/${file}`);
    assert.equal(url.pathname, `/subsite/${release}/${file}`);
    assert.equal(url.search, '?source=bookmark');
    assert.equal(url.hash, '#projects');
    assert.ok(files.has(`${release}/${file}`));
  }
}

test('default builds retain links and route into immutable releases', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'tape4fun-build-'));
  try {
    for (const name of ['index.html', 'en', 'zh-cn', 'assets', 'scripts']) {
      await cp(path.join(root, name), path.join(fixture, name), { recursive: true });
    }
    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
    const build = (...args) => run(process.execPath, ['scripts/build.mjs', ...args], { cwd: fixture });
    await build();
    const first = await snapshot(path.join(fixture, 'dist'));
    checkLinks(first);
    const script = [...first.keys()].find((file) => file.endsWith('/language.js'));
    assert.match(script, /^assets\/[a-f0-9]{64}\/language\.js$/);
    assert.ok(first.has('en/ecosystem.html'));
    assert.ok(first.has('zh-cn/ecosystem.html'));
    checkLegacyEntries(first);
    assert.ok([...first.keys()].some((file) => file.endsWith('/tapeout-logo.jpg.webp')));
    assert.ok(![...first.keys()].some((file) => file.endsWith('/tapqq-v1-mobile.jpg.webp')));
    checkRouter(first, 'https://test.invalid/', script);
    checkRouter(first, 'https://test.invalid/subsite/index.html', script);
    await writeFile(path.join(fixture, 'dist/stale.html'), 'stale build artifact');
    await build();
    assert.deepEqual(await snapshot(path.join(fixture, 'dist')), first);
    const changed = path.join(fixture, 'en/index.html');
    await writeFile(changed, (await readFile(changed, 'utf8')).replace('TAPE4FUN', 'Tape4Fun updated'));
    await build();
    const second = await snapshot(path.join(fixture, 'dist'));
    checkLinks(second);
    checkLegacyEntries(second);
    assert.notEqual(second.get('zh-cn/ecosystem.html'), first.get('zh-cn/ecosystem.html'));
    assert.notEqual(second.get('index.html'), first.get('index.html'));
    const firstAssets = new Map([...first].filter(([file]) => file.startsWith('assets/')));
    const secondAssets = new Map([...second].filter(([file]) => file.startsWith('assets/')));
    assert.deepEqual(secondAssets, firstAssets, 'page edits reuse every unchanged asset');
    for (const [file, content] of second) {
      if (/^(releases|assets)\//.test(file) && first.has(file)) assert.equal(content, first.get(file));
    }
    const sourceScript = path.join(fixture, 'assets/language.js');
    await writeFile(sourceScript, (await readFile(sourceScript, 'utf8')) + '\nglobalThis.buildTest = true;');
    await build();
    const third = await snapshot(path.join(fixture, 'dist'));
    checkLinks(third);
    const nextScript = [...third.keys()].find((file) => file.endsWith('/language.js'));
    assert.notEqual(nextScript, script, 'changed scripts receive a new immutable path');
    checkRouter(third, 'https://test.invalid/', nextScript);
    for (const [file, content] of firstAssets) {
      if (file === script) continue;
      assert.equal(third.get(file), content, 'script edits still reuse unchanged images');
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
