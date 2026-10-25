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

Build the production site and preview it:

```bash
npm run build
npm run preview
```

The build recreates `dist/` with the same page directories and relative links. It minifies HTML, inline CSS/JavaScript, standalone CSS/JavaScript, and SVGs. PNG/JPEG images become WebP at quality 85 without resizing; local HTML/CSS references are updated automatically. Source files stay unchanged. Other assets are copied, and hidden files are excluded. The build prints per-file sizes and total savings.

Upload the **contents of `dist/`** to your static web host. `deploy.sh` builds first and uploads this directory to the existing server (it also retains the existing Git commit/push steps). Node.js is only needed locally to build; the server serves static files. Gzip/Brotli transport compression can additionally be enabled on the host.

The site explains public information and links to primary sources. Verify technical details, live parameters, and product status against official contracts and websites.

For chain hosting that only allows replacing the root `index.html`, use:

```bash
npm run build:chain
npm run preview:chain
```

Upload the **contents of `dist-chain/`**, with `index.html` at the upload root. All other files live under `releases/<SHA-256>/`. The hash comes from the complete compiled site: identical builds reuse the same paths and bytes; a changed build gets a new release directory. Root links and automatic language routing point to that release, while navigation, language switches, and assets keep their relative paths within it. Publish the release files before replacing the root entry if uploading in stages. Keep older releases on chain so existing links continue working. Regular `npm run build` and server deployment still use `dist/`.
