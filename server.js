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
            if (err) { reject(stderr || stdout || err.message); return; }
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

function defaultPengurus() {
    return [
        { id: 1, judul: "Wali Kelas", isi: "Eka Devi Safitri", mediaUrl: "", mediaType: "" },
        { id: 2, judul: "Ketua Kelas", isi: "Alby Yudhira S.", mediaUrl: "", mediaType: "" },
        { id: 3, judul: "Wakil Ketua", isi: "Kayla Ayudya R.", mediaUrl: "", mediaType: "" },
        { id: 4, judul: "Sekertaris", isi: "Nayla Azka A.", mediaUrl: "", mediaType: "" },
        { id: 5, judul: "Sekertaris 2", isi: "Asyraf Reje M.", mediaUrl: "", mediaType: "" },
        { id: 6, judul: "Bendahara", isi: "Arkananta Yaala M.", mediaUrl: "", mediaType: "" },
        { id: 7, judul: "Seksi Kebersihan", isi: "Carissa Rana S.", mediaUrl: "", mediaType: "" },
        { id: 8, judul: "Seksi Keamanan", isi: "Ahmad Kurniawan", mediaUrl: "", mediaType: "" }
    ];
}

function defaultJadwal() {
    return [
        { id: 101, judul: "📚 SENIN", isi: "AQIDAH AKHLAK\nTAHFIDZ\nQUR'AN HADIST\nIPA\n-MATEMATIKA\n-IPS" },
        { id: 102, judul: "📚 SELASA", isi: "TIK\nBK\nBAHASA INDONESIA\nSKI\n-TAHFIDZ\n-MATEMATIKA" },
        { id: 103, judul: "📚 RABU", isi: "BAHASA INGGRIS\nBAHASA LAMPUNG\nFIKIH\nSBDP\n-MYRES\n-BIOLOGI" },
        { id: 104, judul: "📚 KAMIS", isi: "IPS\nMATEMATIKA\nBAHASA ARAB\n-BAHASA INGGRIS\n-FISIKA" },
        { id: 105, judul: "📚 JUM'AT", isi: "PENJAS\nPKN\nIPA" },
        { id: 106, judul: "📚 SABTU", isi: "MATEMATIKA\nBAHASA INDONESIA" }
    ];
}

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return {
            judul: "STOVENSA",
            deskripsi: "Pusat Informasi, Berita Kegiatan, Jadwal Pelajaran, dan Struktur Kelas Stovensa.",
            berita: [],
            jadwal: defaultJadwal(),
            pengurus: defaultPengurus(),
            anggota: []
        };
    }
    try {
        const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        if (!Array.isArray(d.berita)) d.berita = [];
        if (!Array.isArray(d.jadwal) || d.jadwal.length === 0) d.jadwal = defaultJadwal();
        if (!Array.isArray(d.pengurus) || d.pengurus.length === 0) d.pengurus = defaultPengurus();
        if (!Array.isArray(d.anggota)) d.anggota = [];
        return d;
    } catch {
        return { judul: "STOVENSA", deskripsi: "Pusat Informasi Stovensa.", berita: [], jadwal: defaultJadwal(), pengurus: defaultPengurus(), anggota: [] };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function generateCards(items, emptyText) {
    if (!items || items.length === 0) {
        return `<div class="card"><div class="card-body"><h3>Belum Ada Data</h3><p>${emptyText}</p></div></div>`;
    }
    return items.map(item => {
        let mediaTag = "";
        if (item.mediaUrl) {
            if (item.mediaType === "video") {
                mediaTag = `<div class="card-media"><video controls preload="metadata"><source src="${escapeHTML(item.mediaUrl)}"></video></div>`;
            } else {
                mediaTag = `<div class="card-media"><img src="${escapeHTML(item.mediaUrl)}" alt="${escapeHTML(item.judul)}"></div>`;
            }
        }
        return `
            <div class="card">
                ${mediaTag}
                ${(item.judul || item.isi) ? `
                    <div class="card-body">
                        ${item.judul ? `<h3>${escapeHTML(item.judul)}</h3>` : ''}
                        ${item.isi ? `<p>${escapeHTML(item.isi)}</p>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join("");
}

function generatePengurusHTML(items) {
    if (!items || items.length === 0) items = defaultPengurus();
    
    return `<div class="tree-container">` + items.map(p => {
        let photoTag = "";
        if (p.mediaUrl) {
            photoTag = `<div class="node-photo"><img src="${escapeHTML(p.mediaUrl)}" alt="${escapeHTML(p.isi)}"></div>`;
        } else {
            const inisial = (p.isi || "S").charAt(0).toUpperCase();
            photoTag = `<div class="node-photo-placeholder">${inisial}</div>`;
        }
        return `
            <div class="tree-node">
                ${photoTag}
                <div class="title">${escapeHTML(p.judul)}</div>
                <div class="name">${escapeHTML(p.isi)}</div>
            </div>
        `;
    }).join("") + `</div>`;
}

function createWebsite(data) {
    if (!fs.existsSync(INDEX_FILE)) return;
    let html = fs.readFileSync(INDEX_FILE, "utf8");

    const title = escapeHTML(data.judul);
    const description = escapeHTML(data.deskripsi);

    html = html.replace(/(<title>)([\s\S]*?)(<\/title>)/i, `$1${title} - Official Website$3`);
    html = html.replace(/(<h1[^>]*>)([\s\S]*?)(<\/h1>)/i, `$1${title}$3`);

    html = html.replace(
        /<!-- STOVENSA_DESKRIPSI_START -->[\s\S]*?<!-- STOVENSA_DESKRIPSI_END -->/i,
        `<!-- STOVENSA_DESKRIPSI_START -->\n<p>${description}</p>\n<!-- STOVENSA_DESKRIPSI_END -->`
    );

    const beritaHTML = generateCards(data.berita, "Berita terbaru akan muncul di sini.");
    const jadwalHTML = generateCards(data.jadwal, "Jadwal terbaru akan muncul di sini.");
    const pengurusHTML = generatePengurusHTML(data.pengurus);

    html = html.replace(/<!-- STOVENSA_BERITA_START -->[\s\S]*?<!-- STOVENSA_BERITA_END -->/i, `<!-- STOVENSA_BERITA_START -->\n${beritaHTML}\n<!-- STOVENSA_BERITA_END -->`);
    html = html.replace(/<!-- STOVENSA_JADWAL_START -->[\s\S]*?<!-- STOVENSA_JADWAL_END -->/i, `<!-- STOVENSA_JADWAL_START -->\n${jadwalHTML}\n<!-- STOVENSA_JADWAL_END -->`);
    html = html.replace(/<!-- STOVENSA_STRUKTUR_START -->[\s\S]*?<!-- STOVENSA_STRUKTUR_END -->/i, `<!-- STOVENSA_STRUKTUR_START -->\n${pengurusHTML}\n<!-- STOVENSA_STRUKTUR_END -->`);

    const anggotaJS = JSON.stringify(data.anggota || []);
    html = html.replace(/let daftarAnggota = \[[\s\S]*?\];/i, `let daftarAnggota = ${anggotaJS};`);

    fs.writeFileSync(INDEX_FILE, html, "utf8");
}

async function updateGitHub() {
    await git(["add", "."]);
    try {
        await git(["commit", "-m", "Update Pengurus dan 25 Anggota dari Admin Panel"]);
    } catch (e) {
        if (!String(e).includes("nothing to commit")) throw e;
    }
    await git(["push", "origin", "main"]);
}

function receiveBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => {
            body += chunk;
            if (body.length > 150 * 1024 * 1024) { reject(new Error("File terlalu besar")); req.destroy(); }
        });
        req.on("end", () => {
            try { resolve(JSON.parse(body)); } catch { reject(new Error("Data tidak valid")); }
        });
        req.on("error", reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/admin.html")) {
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

            if (input.aksi === "tambah_post") {
                const kat = input.kategori || "berita";
                let mediaUrl = "";
                let mediaType = "";

                if (input.mediaData) {
                    mediaType = input.mediaType || "image";
                    const extension = mediaType === "video" ? ".mp4" : ".jpg";
                    const filename = Date.now() + "_" + Math.random().toString(36).slice(2, 8) + extension;
                    mediaUrl = "media/" + filename;
                    const output = path.join(ROOT, mediaUrl);

                    const cleanBase64 = input.mediaData.includes(",") ? input.mediaData.split(",")[1] : input.mediaData;
                    fs.writeFileSync(output, Buffer.from(cleanBase64, "base64"));
                }

                if (!Array.isArray(data[kat])) data[kat] = [];
                data[kat].unshift({
                    id: Date.now(),
                    judul: input.judul || "",
                    isi: input.isi || "",
                    mediaUrl,
                    mediaType
                });
            }

            if (input.aksi === "update_pengurus_foto") {
                const item = data.pengurus.find(p => String(p.id) === String(input.id));
                if (item && input.mediaData) {
                    const filename = "pengurus_" + item.id + "_" + Date.now() + ".jpg";
                    const mediaUrl = "media/" + filename;
                    const output = path.join(ROOT, mediaUrl);
                    const cleanBase64 = input.mediaData.includes(",") ? input.mediaData.split(",")[1] : input.mediaData;
                    fs.writeFileSync(output, Buffer.from(cleanBase64, "base64"));
                    item.mediaUrl = mediaUrl;
                }
            }

            if (input.aksi === "hapus_post") {
                const kat = input.kategori || "berita";
                if (Array.isArray(data[kat])) {
                    const item = data[kat].find(x => String(x.id) === String(input.id));
                    if (item && item.mediaUrl) {
                        const filePath = path.join(ROOT, item.mediaUrl);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                    data[kat] = data[kat].filter(x => String(x.id) !== String(input.id));
                }
            }

            saveData(data);
            createWebsite(data);
            await updateGitHub();

            return json(res, 200, { success: true, message: "Berhasil di-push ke GitHub!" });
        } catch (error) {
            console.error(error);
            return json(res, 500, { success: false, message: String(error) });
        }
    }

    if (req.method === "GET") {
        let requested = decodeURIComponent(req.url.split("?")[0]);
        const filePath = path.join(ROOT, requested);

        if (filePath.startsWith(ROOT) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            let contentType = "text/plain";
            if (filePath.endsWith(".html")) contentType = "text/html";
            else if (filePath.endsWith(".css")) contentType = "text/css";
            else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) contentType = "image/jpeg";
            else if (filePath.endsWith(".png")) contentType = "image/png";
            else if (filePath.endsWith(".mp4")) contentType = "video/mp4";

            return send(res, 200, contentType, fs.readFileSync(filePath));
        }
    }

    send(res, 404, "text/plain", "Tidak ditemukan.");
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("----------------------------------------");
    console.log("⚡ Server Admin Stovensa Aktif!");
    console.log("👉 Buka di Browser: http://localhost:" + PORT);
    console.log("----------------------------------------");
});
