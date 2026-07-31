/**
 * Zero-dependency static server (streamed, cache-friendly)
 * Usage: npm start   or   node server.js [port]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, cleaned);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

function cacheControl(ext) {
  if (ext === ".html") return "no-cache";
  if (ext === ".json") return "public, max-age=60, stale-while-revalidate=300";
  if (ext === ".js" || ext === ".css") return "public, max-age=300";
  if (ext === ".webp" || ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".gif") {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=86400";
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const filePath = safeJoin(ROOT, u.pathname === "/" ? "/index.html" : u.pathname);

    if (!filePath) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || "application/octet-stream";
      const headers = {
        "Content-Type": type,
        "Content-Length": st.size,
        "Cache-Control": cacheControl(ext),
        "Accept-Ranges": "bytes",
      };

      // range support for large images
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (m) {
          const start = m[1] ? Number(m[1]) : 0;
          const end = m[2] ? Number(m[2]) : st.size - 1;
          if (start <= end && end < st.size) {
            res.writeHead(206, {
              ...headers,
              "Content-Length": end - start + 1,
              "Content-Range": `bytes ${start}-${end}/${st.size}`,
            });
            fs.createReadStream(filePath, { start, end }).pipe(res);
            return;
          }
        }
      }

      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    console.error(e);
    res.writeHead(500).end("Server Error");
  }
});

server.listen(PORT, () => {
  console.log("");
  console.log("  嫣");
  console.log(`  → http://localhost:${PORT}`);
  console.log("  Ctrl+C 退出");
  console.log("");
});
