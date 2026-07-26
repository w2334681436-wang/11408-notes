# 11408 考研笔记框架系统

这是一个可安装、可完全离线使用的 11408 电子笔记系统。入口为 `index.html`，样式位于 `styles/app.css`，主逻辑位于 `src/app.js`。

## 功能

- 高数、线代、概率论、数据结构、计算机组成原理、操作系统、计算机网络、英语、政治九科目录
- Markdown 编辑、实时预览、公式渲染、代码块、表格与图片
- HTML 动画/演示代码编辑与独立渲染窗口
- 全局搜索、页内搜索、思维框架、章节跳转
- IndexedDB 本地自动保存
- JSON 完整导入导出
- `.11408section` 小节包导入
- PWA 安装与完整离线缓存

## 真正离线的实现

本项目不再从 jsDelivr 等外部 CDN 加载公式库。构建时会把 MathJax 3.2.2 完整公式组件复制到本站 `vendor/mathjax/tex-svg.js`，Service Worker 会在首次成功打开时一次性预缓存：

- 页面入口与清单
- CSS 与全部应用脚本
- 本地 MathJax 公式库
- 应用图标

首次联网打开并出现“离线资源已缓存完成”后，即使关闭网络，也可以再次打开、编辑、搜索、渲染公式、导入导出笔记。插入到软件中的图片以本地数据保存，也可离线显示。

> 手工写入 Markdown 或 HTML 的外链图片不属于应用自身资源。只有在联网时访问过并被运行时缓存的外链图片，才可能在断网后继续显示。需要长期离线保存的图片，请使用软件的“插入图片”功能。

## 构建

需要 Node.js 18 或更高版本：

```bash
npm install
npm run build
```

构建结果位于 `dist/`。`dist/` 内不依赖境外 CDN，可部署到任意静态网站托管，也可通过本地静态服务器运行：

```bash
cd dist
python -m http.server 5173
```

浏览器打开 `http://localhost:5173`。

## Vercel 部署

仓库已包含 `vercel.json`。Vercel 会自动执行 `npm run build` 并发布 `dist/`，无需额外配置。`service-worker.js` 使用禁止缓存响应头，以保证新版离线缓存能及时更新。

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 后会自动构建并部署 `dist/`。

首次使用时，需要在仓库的 **Settings → Pages → Build and deployment** 中把 Source 设为 **GitHub Actions**。

## 安装到设备

- Android / Windows / macOS 的 Chromium 浏览器：点击页面中的“安装离线版”，或使用浏览器地址栏的安装按钮。
- iPhone / iPad Safari：点“分享”→“添加到主屏幕”。
- 安装后从桌面图标启动，体验与独立软件一致。

## 数据说明

- 笔记保存在当前浏览器的 IndexedDB 中，不会自动上传 GitHub。
- 换设备或清理浏览器数据前，请先点击“导出”保存 JSON 备份。
- 新设备使用“导入”恢复数据。
- 更新程序代码不会删除 IndexedDB 中的笔记。

## 小节包格式

在目录中选中目标小节，点击“导入小节包”，选择 `.11408section` 文件。导入只替换当前节点的 Markdown、HTML 和图片资源，不影响其他笔记。

```json
{
  "app": "11408-notes-section-package",
  "version": 1,
  "target": {
    "subjectId": "ds",
    "subjectName": "数据结构",
    "path": ["第五章 树与二叉树", "5.1 树的基本概念"]
  },
  "section": {
    "title": "5.1 树的基本概念",
    "md": "正文中的图片使用短标签：\\n\\n[[图片:img_example]]",
    "html": "",
    "assets": [
      {
        "id": "img_example",
        "name": "树的结构示意图.webp",
        "type": "image",
        "src": "data:image/webp;base64,..."
      }
    ]
  }
}
```
