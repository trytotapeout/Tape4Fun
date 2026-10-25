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

The build recreates `dist/` with a replaceable root `index.html`, versioned pages under `releases/<SHA-256>/`, and shared resources under `assets/<content SHA-256>/<filename>`. It minifies HTML, inline CSS/JavaScript, standalone CSS/JavaScript, and SVGs. PNG/JPEG images become WebP at quality 85 without resizing; local HTML/CSS references are updated automatically. Image archives with no asset-path references in the built HTML, CSS, JavaScript, or SVG are omitted. Source files stay unchanged. Other assets are copied, and hidden files are excluded. The build prints per-file sizes and total savings.

Upload the **contents of `dist/`** to your static web host. `deploy.sh` builds first and uploads this directory to the existing server (it also retains the existing Git commit/push steps). Node.js is only needed locally to build; the server serves static files. Gzip/Brotli transport compression can additionally be enabled on the host.

The site explains public information and links to primary sources. Verify technical details, live parameters, and product status against official contracts and websites.

Upload the **contents of `dist/`**, with `index.html` at the upload root. This layout supports chain hosting that only allows replacing the root `index.html`. The release hash comes from compiled pages with their resource links: identical builds reuse the same paths and bytes; a changed page gets a new page release directory. Each resource is hashed independently, so page-only edits preserve resource paths and allow the publisher to reuse existing images and scripts. Pages are still versioned together because they link to one another. The first upload after adopting this layout introduces new resource paths; later uploads can reuse them. Root links and automatic language routing point to the current release. Publish assets and release files before replacing the root entry if uploading in stages. Keep older files on the host so existing links continue working. `deploy.sh` uploads assets and releases first and then the root entry. Actual gas estimates must be checked in the publisher; byte savings do not directly predict gas savings.
