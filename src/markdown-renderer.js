(function (global) {
  'use strict';

  const TOKEN_PREFIX = 'NMRPH';
  let markdownEngine = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function normalizeMarkdown(input) {
    let text = String(input || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u2028\u2029]/g, '\n')
      .replace(/\u200b/g, '')
      .replace(/｀/g, '`')
      .replace(/＄/g, '$');

    const escapedNewlines = (text.match(/\\n/g) || []).length;
    const realNewlines = (text.match(/\n/g) || []).length;
    if (escapedNewlines >= 3 && realNewlines <= 2) text = text.replace(/\\n/g, '\n');

    // 修复 AI/JSON 把围栏边界换行保存为字面量 "\\n" 的情况，代码正文中的 \\n 保持不变。
    text = text
      .replace(/(^|\n)([ \t]*)(`{3,}|~{3,})([a-zA-Z0-9_#+.-]*)\\n(\\n)?/g, (_, start, indent, fence, lang, second) => `${start}${indent}${fence}${lang}\n${second ? '\n' : ''}`)
      .replace(/\\n([ \t]*)(`{3,}|~{3,})(?=[ \t]*(?:\n|$))/g, '\n$1$2');

    // 成对转义的美元符号来自聊天软件/JSON，不是“显示普通美元符号”，应恢复为数学分隔符。
    text = text
      .replace(/\\\$\\\$([\s\S]*?)\\\$\\\$/g, (_, body) => `$$${body}$$`)
      .replace(/\\\$([^\n]*?)\\\$/g, (whole, body) => body.trim() ? `$${body}$` : whole);

    return text;
  }

  function createStash() {
    const values = [];
    return {
      add(html, block = false) {
        const token = `${TOKEN_PREFIX}${values.length}X`;
        values.push({ token, html, block });
        return token;
      },
      restore(rendered) {
        let html = String(rendered || '');
        for (const item of values) {
          if (item.block) {
            const wrapped = new RegExp(`<p>\\s*${item.token}\\s*<\\/p>`, 'g');
            html = html.replace(wrapped, item.html);
          }
          html = html.split(item.token).join(item.html);
        }
        return html;
      }
    };
  }

  function protectFencedCode(text, stash) {
    const lines = text.split('\n');
    const output = [];
    for (let index = 0; index < lines.length; index++) {
      const opening = lines[index].match(/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s]*)[^\n]*$/);
      if (!opening) {
        output.push(lines[index]);
        continue;
      }

      const fence = opening[1];
      const marker = fence[0];
      const language = String(opening[2] || '').replace(/[^a-zA-Z0-9_#+.-]/g, '');
      const code = [];
      let closed = false;
      for (index += 1; index < lines.length; index++) {
        const closing = lines[index].match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
        if (closing && closing[1][0] === marker && closing[1].length >= fence.length) {
          closed = true;
          break;
        }
        code.push(lines[index]);
      }
      if (!closed) index = lines.length;
      const className = language ? ` class="language-${escapeAttr(language)}"` : '';
      const token = stash.add(`<pre><code${className}>${escapeHtml(code.join('\n').replace(/^\n+|\n+$/g, ''))}</code></pre>`, true);
      output.push('', token, '');
    }
    return output.join('\n');
  }

  function protectInlineCode(text, stash) {
    return text.replace(/(`+)([\s\S]*?)\1/g, (_, fence, body) => {
      const normalized = body.replace(/^ | $/g, '').replace(/\n/g, ' ');
      return stash.add(`<code>${escapeHtml(normalized)}</code>`);
    });
  }

  function protectImages(text, stash, resolveImage) {
    const makeImage = (id, alt) => {
      const asset = typeof resolveImage === 'function' ? resolveImage(String(id || '').trim(), String(alt || '')) : null;
      if (!asset || !asset.src) return stash.add('<span class="markdown-image-missing">[图片丢失]</span>');
      const label = asset.alt || alt || asset.name || '图片';
      return stash.add(`<img alt="${escapeAttr(label)}" src="${escapeAttr(asset.src)}" />`, true);
    };
    return text
      .replace(/\[\[图片:([^\]]+)\]\]/g, (_, id) => makeImage(id, '图片'))
      .replace(/!\[([^\]]*)\]\(asset:([^)]+)\)/g, (_, alt, id) => makeImage(id, alt));
  }

  function protectMath(text, stash) {
    const block = body => stash.add(`<div class="math-block">\\[${escapeHtml(String(body || '').trim())}\\]</div>`, true);
    const inline = body => stash.add(`<span class="math-inline">\\(${escapeHtml(String(body || '').trim())}\\)</span>`);

    let output = text
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, body) => block(body))
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => block(body))
      .replace(/\\begin\{([a-zA-Z*]+)\}([\s\S]*?)\\end\{\1\}/g, (_, env, body) => block(`\\begin{${env}}${body}\\end{${env}}`))
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => inline(body));

    output = output.replace(/(^|[^\\$])\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_, prefix, body) => {
      if (!body.trim()) return `${prefix}$${body}$`;
      return prefix + inline(body);
    });
    return output;
  }

  function getMarkdownEngine() {
    if (markdownEngine) return markdownEngine;
    if (typeof global.markdownit !== 'function') return null;
    markdownEngine = global.markdownit({
      html: false,
      linkify: true,
      breaks: true,
      typographer: false
    });
    const defaultLinkOpen = markdownEngine.renderer.rules.link_open;
    markdownEngine.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noopener noreferrer');
      return defaultLinkOpen ? defaultLinkOpen(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
    };
    return markdownEngine;
  }

  function enhanceTaskLists(html) {
    return String(html || '').replace(/<li>\[([ xX])\]\s*/g, (_, checked) => {
      const isChecked = checked.toLowerCase() === 'x';
      return `<li class="task-list-item"><input type="checkbox" disabled${isChecked ? ' checked' : ''}> `;
    });
  }

  function render(input, options = {}) {
    const engine = getMarkdownEngine();
    if (!engine) return null;
    const stash = createStash();
    let markdown = normalizeMarkdown(input);
    if (!markdown.trim()) return '';
    markdown = protectFencedCode(markdown, stash);
    markdown = protectInlineCode(markdown, stash);
    markdown = protectImages(markdown, stash, options.resolveImage);
    markdown = protectMath(markdown, stash);
    return stash.restore(enhanceTaskLists(engine.render(markdown)));
  }

  global.NotesMarkdownRenderer = {
    render,
    normalize: normalizeMarkdown
  };
})(typeof window !== 'undefined' ? window : globalThis);
