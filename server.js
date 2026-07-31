/**
 * Zero-dependency local static server for Velvet Gallery.
 * Usage: npm start   or   node server.js [port]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 3000;
const ROOT = __dirname;

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
  if (!full.startsWith(root)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let filePath = safeJoin(ROOT, u.pathname === "/" ? "/index.html" : u.pathname);

    if (!filePath) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    let type = MIME[ext] || "application/octet-stream";

    // sniff WebP mislabeled as .jpg/.jpeg
    const data = fs.readFileSync(filePath);
    if (
      (ext === ".jpg" || ext === ".jpeg") &&
      data.length >= 12 &&
      data.slice(0, 4).toString("ascii") === "RIFF" &&
      data.slice(8, 12).toString("ascii") === "WEBP"
    ) {
      type = "image/webp";
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": ext === ".html" || ext === ".json" ? "no-cache" : "public, max-age=86400",
    });
    res.end(data);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end("Server Error");
  }
});

server.listen(PORT, () => {
  console.log("");
  console.log("  是嫣嫣呀");
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → http://127.0.0.1:${PORT}`);
  console.log("  Ctrl+C 退出");
  console.log("");
});
