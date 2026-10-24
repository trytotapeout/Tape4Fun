import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';
import CleanCSS from 'clean-css';
import sharp from 'sharp';
import { optimize } from 'svgo';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
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
  const destination = path.join(dist, imagePaths.get(file) ?? file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, output);
  const size = Buffer.byteLength(output);
  before += input.length;
  after += size;
  console.log(`${file}: ${input.length.toLocaleString()} → ${size.toLocaleString()} bytes`);
}
console.log(`\nBuilt ${files.length} files in dist: ${(before / 1024).toFixed(1)} → ${(after / 1024).toFixed(1)} KiB (${((1 - after / before) * 100).toFixed(1)}% smaller)`);
