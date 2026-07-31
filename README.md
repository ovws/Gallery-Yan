# 嫣嫣相册模板

静态图片展示站：瀑布流 + 缩略图 + 灯箱。  
**换图即可变成新项目**，不必改业务逻辑。

## 快速变成一个新站

1. **复制整个文件夹**（或 clone 本仓库）
2. 编辑 `site.config.js`：
   ```js
   window.SITE = {
     title: "浏览器标签标题",
     brand: "页眉显示名",
     tagline: "",
     domain: "xxx.example.com",
   };
   ```
3. **清空并放入新图**到 `images/`（建议命名 `img_0001.webp` / `.jpg` / `.png`）
4. 生成缩略图与清单：
   ```bash
   npm install
   npm run thumbs
   ```
5. 如需自定义域名：改 `CNAME` 文件内容
6. 推到 GitHub 新仓库，接 GitHub Pages 或 Vercel

## 本地预览

```bash
npm start
# http://localhost:3000
```

## 目录说明

| 路径 | 作用 |
|------|------|
| `site.config.js` | 标题 / 品牌（换项目必改） |
| `images/` | 原图 |
| `images/thumbs/` | 缩略图（`npm run thumbs` 生成） |
| `images.json` | 图片清单与宽高（生成脚本写出） |
| `index.html` / `app.js` / `styles.css` | 页面与逻辑 |
| `CNAME` | GitHub Pages 自定义域名 |
| `favicon.svg` | 标签页图标 |

## 部署

- **GitHub Pages**：公开仓库 → Settings → Pages → `main` / root  
- **Vercel**：导入仓库，静态站即可（`npm run build` 为空操作）

## 注意

- 不要直接改 `images.json` 手写路径，以 `npm run thumbs` 为准  
- 图片尽量用 webp/jpg，单张不宜过大  
