const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MEDIA_DIR = path.join(ROOT, "media");
const DATA_FILE = path.join(DATA_DIR, "site.json");
const INDEX_FILE = path.join(ROOT, "index.html");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

function git(args) {
    return new Promise((resolve, reject) => {
        execFile("git", args, { cwd: ROOT }, (err, stdout, stderr) => {
            if (err) {
                reject(stderr || stdout || err.message);
                return;
            }
            resolve(stdout);
        });
    });
}

function send(res, code, type, data) {
    res.writeHead(code, { "Content-Type": type + "; charset=utf-8" });
    res.end(data);
}

function json(res, code, data) {
    send(res, code, "application/json", JSON.stringify(data));
}

function escapeHTML(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return {
            judul: "STOVENSA",
            deskripsi: "Website informasi Stovensa.",
            berita: [],
            foto: [],
            video: []
        };
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
        return {
            judul: "STOVENSA",
            deskripsi: "Website informasi Stovensa.",
            berita: [],
            foto: [],
            video: []
        };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function createWebsite(data) {
    let html = fs.readFileSync(INDEX_FILE, "utf8");

    const title = escapeHTML(data.judul);
    const description = escapeHTML(data.deskripsi);

    html = html.replace(/(<title>)([\s\S]*?)(<\/title>)/i, `$1${title}$3`);
    html = html.replace(/(<h1[^>]*>)([\s\S]*?)(<\/h1>)/i, `$1${title}$3`);

    html = html.replace(
        /<!-- STOVENSA_DESKRIPSI_START -->[\s\S]*?<!-- STOVENSA_DESKRIPSI_END -->/i,
        `<!-- STOVENSA_DESKRIPSI_START -->\n<p>${description}</p>\n<!-- STOVENSA_DESKRIPSI_END -->`
    );

    const beritaHTML = data.berita.length > 0 ? data.berita.map(item => `
        <div class="card show">
            <div class="icon">📰</div>
            <h3>${escapeHTML(item.judul)}</h3>
            <p>${escapeHTML(item.isi)}</p>
        </div>
    `).join("") : '<div class="card show"><div class="icon">📰</div><h3>Belum ada berita</h3><p>Berita terbaru akan muncul di sini.</p></div>';

    const fotoHTML = data.foto.length > 0 ? data.foto.map(item => `
        <div class="card media-card show">
            <img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.nama)}">
        </div>
    `).join("") : '<div class="card show"><div class="icon">📸</div><h3>Belum ada foto</h3><p>Foto kegiatan akan muncul di sini.</p></div>';

    const videoHTML = data.video.length > 0 ? data.video.map(item => `
        <div class="card media-card show">
            <video controls preload="metadata"><source src="${escapeHTML(item.url)}"></video>
        </div>
    `).join("") : '<div class="card show"><div class="icon">🎬</div><h3>Belum ada video</h3><p>Video kegiatan akan muncul di sini.</p></div>';

    html = html.replace(/<!-- STOVENSA_BERITA_START -->[\s\S]*?<!-- STOVENSA_BERITA_END -->/i, `<!-- STOVENSA_BERITA_START -->${beritaHTML}<!-- STOVENSA_BERITA_END -->`);
    html = html.replace(/<!-- STOVENSA_FOTO_START -->[\s\S]*?<!-- STOVENSA_FOTO_END -->/i, `<!-- STOVENSA_FOTO_START -->${fotoHTML}<!-- STOVENSA_FOTO_END -->`);
    html = html.replace(/<!-- STOVENSA_VIDEO_START -->[\s\S]*?<!-- STOVENSA_VIDEO_END -->/i, `<!-- STOVENSA_VIDEO_START -->${videoHTML}<!-- STOVENSA_VIDEO_END -->`);

    fs.writeFileSync(INDEX_FILE, html, "utf8");
}

async function updateGitHub() {
    await git(["add", "."]);
    try {
        await git(["commit", "-m", "Update Stovensa dari Admin Panel"]);
    } catch (e) {
        if (!String(e).includes("nothing to commit")) {
            throw e;
        }
    }
    await git(["push", "origin", "main"]);
}

function receiveBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => {
            body += chunk;
            if (body.length > 150 * 1024 * 1024) {
                reject(new Error("File terlalu besar."));
                req.destroy();
            }
        });
        req.on("end", () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("Data JSON tidak valid."));
            }
        });
        req.on("error", reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
        return send(res, 200, "text/html", fs.readFileSync(path.join(ROOT, "admin.html")));
    }

    if (req.method === "GET" && req.url === "/api/data") {
        return json(res, 200, loadData());
    }

    if (req.method === "POST" && req.url === "/api/save") {
        try {
            const input = await receiveBody(req);
            const data = loadData();

            if (typeof input.judul === "string") data.judul = input.judul;
            if (typeof input.deskripsi === "string") data.deskripsi = input.deskripsi;

            // TAMBAH BERITA
            if (input.aksi === "tambah_berita") {
                data.berita.unshift({
                    id: Date.now(),
                    judul: input.beritaJudul || "",
                    isi: input.beritaIsi || ""
                });
            }

            // HAPUS BERITA
            if (input.aksi === "hapus_berita") {
                data.berita = data.berita.filter(x => String(x.id) !== String(input.id));
            }

            // UPLOAD FOTO / VIDEO
            if (input.aksi === "upload_media") {
                const base64 = String(input.data || "");
                const type = input.type === "video" ? "video" : "image";
                const extension = type === "video" ? ".mp4" : ".jpg";
                const filename = Date.now() + "_" + Math.random().toString(36).slice(2, 8) + extension;
                const relative = "media/" + filename;
                const output = path.join(ROOT, relative);

                const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
                fs.writeFileSync(output, Buffer.from(cleanBase64, "base64"));

                const item = { id: Date.now(), nama: input.nama || filename, url: relative };
                if (type === "video") data.video.unshift(item);
                else data.foto.unshift(item);
            }

            // HAPUS FOTO
            if (input.aksi === "hapus_foto") {
                const item = data.foto.find(x => String(x.id) === String(input.id));
                if (item) {
                    const filePath = path.join(ROOT, item.url);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
                data.foto = data.foto.filter(x => String(x.id) !== String(input.id));
            }

            // HAPUS VIDEO
            if (input.aksi === "hapus_video") {
                const item = data.video.find(x => String(x.id) === String(input.id));
                if (item) {
                    const filePath = path.join(ROOT, item.url);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
                data.video = data.video.filter(x => String(x.id) !== String(input.id));
            }

            saveData(data);
            createWebsite(data);
            await updateGitHub();

            return json(res, 200, { success: true, data: data, message: "Berhasil disimpan ke GitHub." });
        } catch (error) {
            console.error(error);
            return json(res, 500, { success: false, message: String(error) });
        }
    }

    if (req.method === "GET") {
        let requested = decodeURIComponent(req.url.split("?")[0]);
        if (requested === "/") requested = "/admin.html";

        const filePath = path.join(ROOT, requested);
        if (filePath.startsWith(ROOT) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return send(res, 200, "text/plain", fs.readFileSync(filePath));
        }
    }

    send(res, 404, "text/plain", "Tidak ditemukan.");
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("Admin Stovensa berjalan di: http://127.0.0.1:" + PORT);
});
