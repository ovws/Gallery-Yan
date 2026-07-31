# 是嫣嫣呀

甜一点、坏一点、刚刚好的氛围感图片站。源码与图片存 **GitHub**，线上部署走 **Vercel**。

## 链接

- 仓库：https://github.com/ovws/Velvet-Gallery
- 本地：`npm start` → http://localhost:3000

## 本地预览（Windows 推荐）

本机若没有真正的 Python，请用 Node（你已安装）：

```bash
cd E:\Show
npm start
```

浏览器打开：**http://localhost:3000**

换端口：

```bash
node server.js 8080
```

> 不要用资源管理器双击 `index.html`（`file://`），`fetch('images.json')` 会失败。

## 部署到 Vercel（推荐）

### 方式 A：网页导入（最稳）

1. 打开 [vercel.com](https://vercel.com) → 登录（用 GitHub 账号）
2. **Add New… → Project**
3. 导入 **`ovws/Velvet-Gallery`**
4. 配置保持默认即可：
   - **Framework Preset**: Other
   - **Build Command**: 留空（或 `npm run build`）
   - **Output Directory**: 留空（根目录静态站）
   - **Install Command**: 可留空
5. 点 **Deploy**

之后每次 `git push` 到 `main`，Vercel 会自动重新部署。

### 方式 B：CLI

```bash
npm i -g vercel
vercel login
vercel          # 预览
vercel --prod   # 生产
```

## 更新图片

1. 把新图放进 `images/`，建议命名 `img_0194.jpg` 这种安全文件名（避免 `#`、空格）
2. 编辑或重新生成 `images.json`（字段：`src` / `name` / `date` / `caption` / `size`）
3. 提交推送：

```bash
git add images images.json
git commit -m "Add new photos"
git push
```

Vercel 会自动上线。

## 项目结构

```
├── index.html      # 页面
├── styles.css      # 样式
├── app.js          # 交互
├── images.json     # 图片清单（文案/日期）
├── images/         # 图片库 img_0001.webp …
├── server.js       # 本地静态服务
├── package.json
└── vercel.json     # Vercel 缓存与路由
```

## 说明

- 原文件名里有中文、`#`、空格，已统一重命名为 `img_XXXX.jpg`，文案保留在 `images.json` 的 `caption` 字段，避免 CDN / URL 踩坑。
- 纯静态站，无后端、无构建产物，Vercel 免费额度完全够用。
