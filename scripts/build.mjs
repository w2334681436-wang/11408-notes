import { access, copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

async function copyRequiredFile(relativePath) {
  const source = resolve(root, relativePath);
  const target = resolve(dist, relativePath);
  await access(source);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ['index.html', 'manifest.json', 'service-worker.js']) {
  await copyRequiredFile(file);
}

for (const directory of ['src', 'styles', 'icons']) {
  await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
}

const mathJaxSource = resolve(root, 'node_modules/mathjax/es5/tex-svg-full.js');
const mathJaxTarget = resolve(dist, 'vendor/mathjax/tex-svg.js');
await access(mathJaxSource);
await mkdir(dirname(mathJaxTarget), { recursive: true });
await copyFile(mathJaxSource, mathJaxTarget);

const markdownItSource = resolve(root, 'node_modules/markdown-it/dist/markdown-it.min.js');
const markdownItTarget = resolve(dist, 'vendor/markdown-it/markdown-it.min.js');
await access(markdownItSource);
await mkdir(dirname(markdownItTarget), { recursive: true });
await copyFile(markdownItSource, markdownItTarget);

const mathJaxLicense = resolve(root, 'node_modules/mathjax/LICENSE');
try {
  await copyFile(mathJaxLicense, resolve(dist, 'vendor/mathjax/LICENSE'));
} catch {
  // 某些包管理器可能不保留许可证文件；不影响应用构建。
}

await writeFile(resolve(dist, '.nojekyll'), '', 'utf8');
console.log('离线 PWA 已构建到 dist/，MathJax 已内置。');
