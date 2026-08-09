import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await fs.readFile(path.join(root, 'src/markdown-renderer.js'), 'utf8');
const sandbox = {
  window: {
    markdownit: options => new MarkdownIt(options)
  },
  globalThis: {}
};
vm.runInNewContext(source, sandbox, { filename: 'markdown-renderer.js' });
const renderer = sandbox.window.NotesMarkdownRenderer;
assert.ok(renderer?.render, 'Markdown renderer must initialize');

const markdown = [
  '# 综合渲染测试',
  '',
  '> 引用第一行',
  '> 引用第二行',
  '',
  '1. 有序列表',
  '   - 嵌套列表',
  '   - [x] 已完成',
  '   - [ ] 未完成',
  '',
  '| 字段 | 含义 |',
  '|---|---|',
  '| SYN | 同步 |',
  '',
  '**加粗**、*斜体*、~~删除线~~、[链接](https://example.com)',
  '',
  '```cpp\\n\\n',
  'int main() {',
  '  return 0;',
  '}',
  '```',
  '',
  '行内代码：`const price = "$5";`',
  '',
  '转义公式：\\$ x+1 \\$',
  '',
  '\\$\\$',
  '\\boxed{\\text{SYN}=1,\\quad \\text{ACK}=1}',
  '\\$\\$',
  '',
  '括号公式：\\(a^2+b^2=c^2\\)',
  '',
  '\\[',
  '\\int_0^1 x^2\\,dx=\\frac13',
  '\\]',
  '',
  '\\begin{aligned}',
  'x&=1\\\\',
  'y&=2',
  '\\end{aligned}',
  '',
  '[[图片:img_demo]]'
].join('\n');

const html = renderer.render(markdown, {
  resolveImage(id) {
    return id === 'img_demo' ? { src: 'data:image/png;base64,AAAA', alt: '示例图片' } : null;
  }
});

assert.match(html, /<h1>综合渲染测试<\/h1>/);
assert.match(html, /<blockquote>/);
assert.match(html, /<ol>/);
assert.match(html, /<ul>/);
assert.match(html, /task-list-item/);
assert.match(html, /<table>/);
assert.match(html, /<strong>加粗<\/strong>/);
assert.match(html, /<em>斜体<\/em>/);
assert.match(html, /<s>删除线<\/s>/);
assert.match(html, /target="_blank"/);
assert.match(html, /<pre><code class="language-cpp">/);
assert.match(html, /const price = &quot;\$5&quot;;/);
assert.match(html, /\\\(x\+1\\\)/);
assert.match(html, /\\\[\\boxed\{\\text\{SYN\}=1/);
assert.match(html, /\\\(a\^2\+b\^2=c\^2\\\)/);
assert.match(html, /\\\[\\int_0\^1/);
assert.match(html, /\\begin\{aligned\}/);
assert.match(html, /data:image\/png;base64,AAAA/);
assert.doesNotMatch(html, /```cpp\\n/);
assert.doesNotMatch(html, /\\\$ x\+1 \\\$/);

console.log('Rendering verification passed: Markdown, code, math, tables, lists, links and images.');
