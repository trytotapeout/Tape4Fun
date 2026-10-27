import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';
import CleanCSS from 'clean-css';
import sharp from 'sharp';
import { optimize } from 'svgo';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = 'dist';
const dist = path.join(root, outputDirectory);
const files = [];

async function collect(relative) {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await collect(name);
    else if (entry.isFile()) files.push(name);
  }
}

files.push('index.html');
for (const directory of ['en', 'zh-cn', 'assets']) await collect(directory);

// Only rewrite known local asset paths; keep the source files untouched.
const imagePaths = new Map(files.filter((file) => /\.(png|jpe?g)$/i.test(file))
  .map((file) => [file, `${file}.webp`]));
function rewriteImages(text) {
  return text.replace(/assets\/[\w./-]+\.(?:png|jpe?g)\b/gi,
    (reference) => imagePaths.get(reference) ?? reference);
}

await rm(dist, { recursive: true, force: true });
let before = 0;
let after = 0;
let outputs = new Map();
for (const file of files.sort()) {
  const input = await readFile(path.join(root, file));
  const extension = path.extname(file).toLowerCase();
  let output = input;
  if (imagePaths.has(file)) {
    output = await sharp(input).webp({ quality: 85, effort: 6 }).toBuffer();
  } else if (extension === '.html') {
    output = await minifyHtml(rewriteImages(input.toString()), {
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
    });
  } else if (extension === '.js') {
    output = (await minifyJs(input.toString())).code;
  } else if (extension === '.css') {
    const result = new CleanCSS().minify(rewriteImages(input.toString()));
    if (result.errors.length) throw new Error(`${file}: ${result.errors.join('; ')}`);
    output = result.styles;
  } else if (extension === '.svg') {
    output = optimize(input.toString(), { path: file, multipass: true }).data;
    if (Buffer.byteLength(output) >= input.length) output = input;
  }
  outputs.set(imagePaths.get(file) ?? file, Buffer.from(output));
  const size = Buffer.byteLength(output);
  before += input.length;
  after += size;
  console.log(`${file}: ${input.length.toLocaleString()} → ${size.toLocaleString()} bytes`);
}

// Do not upload image archives that no built page or script references.
const references = [...outputs]
  .filter(([file]) => /\.(html|css|js|svg)$/.test(file))
  .map(([, content]) => content.toString()).join('\n');
const referencedAssets = new Set(references.match(/assets\/[\w./-]+/g) ?? []);
for (const [file, content] of outputs) {
  if (file.startsWith('assets/') && /\.(webp|svg|gif|avif|ico)$/i.test(file)
    && !referencedAssets.has(file)) {
    outputs.delete(file);
    after -= content.length;
    console.log(`Omitted unused image: ${file}`);
  }
}

// Assets keep their own immutable paths across page-only releases.
const assetPaths = new Map();
const assets = new Map();
for (const [file, content] of outputs) {
  if (!file.startsWith('assets/')) continue;
  const hash = createHash('sha256').update(content).digest('hex');
  const destination = `assets/${hash}/${path.posix.basename(file)}`;
  assetPaths.set(file, destination);
  assets.set(destination, content);
}

function rewriteAssets(text, sourceFile, destinationFile) {
  const home = path.posix.relative(path.posix.dirname(destinationFile), 'index.html');
  return text.replace(/(?:\.\.?\/)*assets\/[\w./-]+/g, (reference) => {
    const original = path.posix.normalize(path.posix.join(path.posix.dirname(sourceFile), reference));
    const target = assetPaths.get(original);
    if (!target) return reference;
    const relative = path.posix.relative(path.posix.dirname(destinationFile), target);
    return relative.startsWith('.') ? relative : `./${relative}`;
  }).replace(/(<a class="site-brand" href=")[^"]+"/g, `$1${home}"`);
}

const entrySource = outputs.get('index.html').toString();
outputs = new Map([...outputs]
  .filter(([file]) => !file.startsWith('assets/'))
  .map(([file, content]) => [file, Buffer.from(rewriteAssets(
    content.toString(), file, `releases/pending/${file}`,
  ))]));

// Hash pages after resolving shared assets. A page change no longer versions
// unchanged images and scripts. Relative page navigation stays within a release.
const hash = createHash('sha256');
for (const [file, content] of outputs) {
  hash.update(JSON.stringify([file, content.length]));
  hash.update(content);
}
const release = `releases/${hash.digest('hex')}`;
const entry = rewriteAssets(entrySource, 'index.html', 'index.html').replace(
  /\b(href|src)=(['"])\.\/(en|zh-cn)\//g,
  `$1=$2./${release}/$3/`,
);
// Keep a versioned entry too: language pages link to ../index.html.
outputs = new Map([...outputs].map(([file, content]) => [`${release}/${file}`, content]));
// Replace pre-versioning URLs with small entry pages for the current release.
// These paths stay mutable; the release files above remain immutable.
for (const file of files.filter((file) => /^(en|zh-cn)\/.*\.html$/.test(file))) {
  const target = path.posix.relative(path.posix.dirname(file), `${release}/${file}`);
  const language = file.startsWith('zh-cn/') ? 'zh-CN' : 'en';
  const label = language === 'zh-CN' ? '打开最新页面' : 'Open the latest page';
  outputs.set(file, Buffer.from(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${target}"><title>Tape4Fun</title></head><body><a href="${target}">${label}</a><script>location.replace(${JSON.stringify(target)}+location.search+location.hash)</script></body></html>`));
}
for (const item of assets) outputs.set(...item);
outputs.set('index.html', Buffer.from(entry));
after = [...outputs.values()].reduce((total, content) => total + content.length, 0);

for (const [file, content] of outputs) {
  const destination = path.join(dist, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
}
console.log(`\nBuilt ${outputs.size} files in ${outputDirectory}: ${(before / 1024).toFixed(1)} → ${(after / 1024).toFixed(1)} KiB (${((1 - after / before) * 100).toFixed(1)}% smaller)`);
console.log(`Release: ${release}`);
