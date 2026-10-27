import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/share.js', import.meta.url), 'utf8');

for (const [name, current, canonical, expected] of [
  ['web article', 'https://tape4fun.com/zh-cn/getting-started.html?preview=1#money', './getting-started.html', 'https://tape4fun.com/zh-cn/getting-started.html'],
  ['subdirectory deployment', 'https://example.org/site/en/tapecode.html?token=private#milestones', './tapecode.html', 'https://example.org/site/en/tapecode.html'],
  ['on-chain gateway', 'https://gateway.example/releases/abc/en/tapecode.html?debug=1#milestones', './tapecode.html', 'https://gateway.example/releases/abc/en/tapecode.html'],
  ['missing canonical', 'https://example.org/en/tapeout.html?preview=1#what', null, 'https://example.org/en/tapeout.html'],
]) {
  test(`X sharing uses the correct URL for ${name}`, () => {
    const title = 'TapeOut 星球：NAND & LATCH / a beginner’s guide';
    let click;
    const events = [];
    const link = { dataset: { shareTitle: title }, addEventListener: (event, callback) => { if (event === 'click') click = callback; } };
    vm.runInNewContext(source, {
      URL,
      location: { href: current },
      document: {
        title: 'fallback title',
        querySelectorAll: () => [link],
        querySelector: () => canonical ? { getAttribute: () => canonical } : null,
      },
      window: { gtag: (...args) => events.push(args) },
    });
    const intent = new URL(link.href);
    assert.equal(intent.origin + intent.pathname, 'https://x.com/intent/tweet');
    assert.equal(intent.searchParams.get('text'), title);
    assert.equal(intent.searchParams.get('url'), expected);
    assert.equal(events.length, 0, 'loading an article does not count as a share click');
    click();
    assert.equal(events.length, 1);
    assert.equal(events[0][1], 'share');
    assert.equal(events[0][2].item_id, expected);
  });
}

test('X sharing works without analytics', () => {
  let click;
  const link = { dataset: {}, addEventListener: (_, callback) => { click = callback; } };
  vm.runInNewContext(source, {
    URL, location: { href: 'https://example.org/en/tapekit.html' },
    document: { title: 'TapeKit', querySelectorAll: () => [link], querySelector: () => null },
    window: {},
  });
  assert.equal(new URL(link.href).searchParams.get('text'), 'TapeKit');
  assert.doesNotThrow(click);
});
