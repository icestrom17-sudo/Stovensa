const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = __dirname;

const server = http.createServer((req, res) => {
    let filePath;

    if (req.url === "/" || req.url === "/admin") {
        filePath = path.join(ROOT, "admin.html");
    } else {
        filePath = path.join(ROOT, req.url);
    }

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8"
            });
            res.end("Halaman tidak ditemukan");
            return;
        }

        const ext = path.extname(filePath);

        const types = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json; charset=utf-8"
        };

        res.writeHead(200, {
            "Content-Type": types[ext] || "text/plain; charset=utf-8"
        });

        res.end(data);
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("================================");
    console.log("   ADMIN STOVENSA");
    console.log("================================");
    console.log(`Server berjalan di: http://127.0.0.1:${PORT}`);
    console.log("");
});
