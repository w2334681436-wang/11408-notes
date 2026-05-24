# 11408 考研笔记框架系统

这是从你上传的单文件 HTML 拆分出来的 GitHub 多文件项目版本，原始文件包含完整的页面结构、CSS 和主脚本。拆分后的入口是 `index.html`，样式在 `styles/app.css`，主逻辑在 `src/app.js`。

## 功能

- 科目切换：高数、线代、概率论、数据结构、计算机组成原理、操作系统、计算机网络、英语、政治
- 章节 / 节 / 子节目录管理
- Markdown 编辑与预览
- 公式渲染：`$...$`、`$$...$$`、`\(...\)`、`\[...\]`
- 图片短标签：`[[图片:img_xxx]]`
- 图片资源随 JSON 导入导出
- HTML 代码编辑与居中弹窗渲染
- 思维框架视图
- IndexedDB 本地保存
- JSON 完整导入导出
- PWA 基础支持：`manifest.json` + `service-worker.js`

## 本地运行

不要直接双击 `index.html` 作为长期运行方式。推荐用本地静态服务器：

```bash
python -m http.server 5173
```

然后浏览器打开：

```text
http://localhost:5173
```

## 上传 GitHub

```bash
git init
git add .
git commit -m "init 11408 notes app"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

## GitHub Pages 部署

在 GitHub 仓库中：

1. Settings
2. Pages
3. Source 选择 `Deploy from a branch`
4. Branch 选择 `main`
5. Folder 选择 `/root`
6. Save

稍等后即可通过 GitHub Pages 链接访问。

## 重要说明

- 你的笔记数据保存在浏览器 IndexedDB 中，不会自动上传 GitHub。
- 换设备时需要在旧设备点击“导出”，在新设备点击“导入”。
- 通过应用插入的图片会进入 JSON 备份，不需要另外传图。
- 如果你在 Markdown 或 HTML 中手写外链图片，JSON 只保存链接，不会保存外链图片本体。
- MathJax 目前通过 CDN 加载，首次公式渲染需要联网。
