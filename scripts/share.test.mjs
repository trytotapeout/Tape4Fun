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
    assert.equal(intent.origin + intent.pathname, 'https://twitter.com/intent/tweet');
    assert.equal(intent.searchParams.get('text'), `${title}\n\n${expected}\n\n#tapeout #tapekit #bem`);
    assert.equal([...intent.searchParams.keys()].join(','), 'text');
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
  assert.equal(new URL(link.href).searchParams.get('text'), 'TapeKit\n\nhttps://example.org/en/tapekit.html\n\n#tapeout #tapekit #bem');
  assert.doesNotThrow(click);
});

for (const language of ['zh-cn', 'en']) {
  test(`${language} pages have social titles and usable share links without JavaScript`, async () => {
    for (const name of ['tapeout', 'tapehub', 'tapekit', 'tapesend', 'tapecode', 'ecosystem', 'getting-started']) {
      const html = await readFile(new URL(`../${language}/${name}.html`, import.meta.url), 'utf8');
      assert.match(html, /<meta property="og:title" content="[^"]+"/);
      assert.match(html, /<meta name="twitter:title" content="[^"]+"/);
      const href = html.match(/<a class="share-x"[^>]* href="([^"]+)"/)[1];
      const intent = new URL(href.replaceAll('&amp;', '&'));
      const text = intent.searchParams.get('text');
      assert.ok(text.includes(`https://tape4fun.com/${language}/${name}.html`));
      assert.ok(text.endsWith('#tapeout #tapekit #bem'));
      assert.ok(text.split('\n')[0].length > 5);
    }
  });
}
