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

// Hash the final bytes before adding the release path. Internal relative links
// stay together inside the release; only the mutable root entry needs rewriting.
const hash = createHash('sha256');
for (const [file, content] of outputs) {
  hash.update(JSON.stringify([file, content.length]));
  hash.update(content);
}
const release = `releases/${hash.digest('hex')}`;
const entry = outputs.get('index.html').toString().replace(
  /\b(href|src)=(['"])\.\/(en|zh-cn|assets)\//g,
  `$1=$2./${release}/$3/`,
);
after += Buffer.byteLength(entry);
// Keep a versioned entry too: language pages link to ../index.html.
outputs = new Map([...outputs].map(([file, content]) => [`${release}/${file}`, content]));
outputs.set('index.html', Buffer.from(entry));

for (const [file, content] of outputs) {
  const destination = path.join(dist, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
}
console.log(`\nBuilt ${outputs.size} files in ${outputDirectory}: ${(before / 1024).toFixed(1)} → ${(after / 1024).toFixed(1)} KiB (${((1 - after / before) * 100).toFixed(1)}% smaller)`);
console.log(`Release: ${release}`);
