# Tape4Fun

An independent bilingual reference to TapeOut infrastructure and valuable products across its surrounding ecosystem.

The site is a static website with English and Simplified Chinese pages under `en/` and `zh-cn/`. Images and other local assets live in `assets/`.

Requires Node.js 20.9+ and npm (Node.js 22 is selected in `.nvmrc`). Install the locked dependencies:

```bash
nvm use # if you use nvm
npm ci
```

Preview the source site locally:

```bash
npm run dev
```

Then open <http://localhost:8000/>.

Build and preview the conventional website:

```bash
npm run build:web
npm run preview:web
```

`npm run build` and `npm run preview` are aliases for the web target. Upload the **contents of `dist/web/`** to the web root. HTML pages have stable paths such as `/zh-cn/tapecode.html`, and the language entry only selects `/en/index.html` or `/zh-cn/index.html`. Navigation never enters a release directory. HTML should use `Cache-Control: no-cache` to revalidate on each visit; assets use content-hashed paths and can be cached for a year with `immutable`.

`deploy.sh` builds and deploys the web target to the existing server. It uploads assets first, language pages next, and the root entry last. It retains Git commit/push, skipping the commit when nothing has changed. It also uploads `config/nginx-entry.conf` to `/etc/nginx/snippets/tape4fun-entry.conf`, validates Nginx, and reloads it. The HTTPS server block must include that snippet once. The snippet redirects historical `/releases/<hash>/...` HTML URLs to the stable web pages, preserving query strings; browsers retain fragments across these redirects. Existing release files remain on disk, but the conventional website serves their current equivalents through redirects.

Build and preview the on-chain package separately:

```bash
npm run build:chain
npm run preview:chain
```

Upload the **contents of `dist/chain/`**, with `index.html` at the upload root. This target supports chain hosting that only allows replacing the root entry: pages are under `releases/<SHA-256>/`, while each asset has its own content-hashed path. Publish assets and release files before replacing root `index.html`. Keep old files so existing on-chain links continue working. Identical builds reuse the same paths; page-only edits preserve unchanged asset paths. Actual gas estimates must be checked in the publisher. The Nginx web redirect rules do not apply to the on-chain package.

Each target rebuilds only its own output directory, so both packages can coexist. Both minify HTML, CSS, JavaScript, and SVGs, convert PNG/JPEG images to WebP at quality 85 without resizing, and omit unused image archives. Source files stay unchanged. Node.js is required only locally; both outputs are static files.

Run the build/navigation regression tests:

```bash
npm run test:build
npm run test:share
```

The site explains public information and links to primary sources. Verify technical details, live parameters, and product status against official contracts and websites.

Article/detail pages include a localized X share link at the end. The link opens X’s composer with the article title, canonical URL, and `#tapeout #tapekit #bem` in one prefilled text field, removes preview/query parameters and fragments, and resolves against the current host for web and chain gateways. Readers confirm publication on X. Existing Google Analytics installations record a `share` click event; the button also works without analytics.
