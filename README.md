# 嫣嫣相册（Gallery-Yan）

静态瀑布流相册。结构和 **Gallery-Demo** 一样，方便统一管理。

| 仓库 | 用途 |
|------|------|
| [Gallery-Yan](https://github.com/ovws/Gallery-Yan) | 正式站（yan.mugou.pro） |
| [Gallery-Demo](https://github.com/ovws/Gallery-Demo) | 模板 / 换图试验 |

## 日常改图

```bash
# 1. 增删 images/ 里的原图（建议 img_0001.webp …）
# 2. 重新生成缩略图 + images.json
npm install
npm run thumbs

# 3. 本地预览
npm start
# http://localhost:3000

# 4. 推送
git add images images.json
git commit -m "Update photos"
git push
```

## 改名字 / 标题

只改 `site.config.js`：

```js
window.SITE = {
  title: "嫣嫣最可爱啦",  // 浏览器标签
  brand: "嫣嫣",          // 页眉
  domain: "yan.mugou.pro",
};
```

## 从本站复制出一个新项目

1. 复制整个文件夹（或 clone 后改 remote）
2. 改 `site.config.js`、`CNAME`
3. 换成新 `images/`，执行 `npm run thumbs`
4. `gh repo create 新仓库名 --public --source=. --push`

## 目录

| 路径 | 作用 |
|------|------|
| `site.config.js` | 标题、品牌 |
| `images/` | 原图 |
| `images/thumbs/` | 缩略图（脚本生成） |
| `images.json` | 清单（脚本生成，勿手改） |
| `CNAME` | GitHub Pages 域名 |
| `scripts/gen-thumbs.js` | 生成缩略图 |

## 部署

- GitHub Pages：`main` 分支 root  
- Vercel：导入仓库即可（`npm run build` 为空操作）
