# Velvet Gallery

一套深色氛围感图片展示站，用于浏览 `images/` 图库。

## 特性

- **瀑布流 / 网格** 双视图切换
- **灯箱预览**：点击放大，键盘 ← → 切换，Esc 关闭，触屏滑动
- **搜索**：按文案、标签、文件名筛选
- **排序**：最新 / 最早 / 名称
- 深色玫瑰金视觉、胶片颗粒与光晕氛围

## 本地预览

需要通过 HTTP 服务打开（`fetch` 加载 `images.json`）：

```bash
# Python
python -m http.server 8080

# 或 Node
npx serve .
```

浏览器访问：http://localhost:8080

## 更新图片

将新的 `.jpg` 放入 `images/`，然后重新生成清单：

```powershell
# PowerShell（Windows）
$files = Get-ChildItem -Path ".\images" -Filter "*.jpg" -File | Sort-Object Name
$images = foreach ($f in $files) {
  $name = $f.Name
  $date = $null; $caption = $null
  if ($name -match 'sad_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_(.+)_(\d+)_(\d+)\.jpg$') {
    $date = $Matches[1]
    $caption = ($Matches[3] -replace '#', ' #').Trim()
  }
  [ordered]@{ src = "images/$name"; name = $name; date = $date; caption = $caption; size = $f.Length }
}
[System.IO.File]::WriteAllText(".\images.json", ($images | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
```

## 部署

推送到 GitHub 后可在仓库 **Settings → Pages** 中启用 GitHub Pages（Source: Deploy from branch / root）。

## 结构

```
├── index.html      # 页面
├── styles.css      # 样式
├── app.js          # 交互
├── images.json     # 图片清单
└── images/         # 图片库
```
