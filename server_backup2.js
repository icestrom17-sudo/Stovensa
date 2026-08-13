const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 3000;
const ROOT = __dirname;

function send(res, status, type, data) {
    res.writeHead(status, {
        "Content-Type": type + "; charset=utf-8"
    });
    res.end(data);
}

function runGit(args) {
    return new Promise((resolve, reject) => {
        execFile("git", args, { cwd: ROOT }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
                return;
            }

            resolve(stdout);
        });
    });
}

const server = http.createServer((req, res) => {

    // =========================
    // MENAMPILKAN FILE
    // =========================

    if (req.method === "GET") {

        let file = req.url === "/"
            ? "admin.html"
            : req.url.substring(1);

        file = path.normalize(file);

        if (file.includes("..")) {
            return send(res, 403, "text/plain", "Forbidden");
        }

        const filePath = path.join(ROOT, file);

        fs.readFile(filePath, (err, data) => {

            if (err) {
                return send(
                    res,
                    404,
                    "text/plain",
                    "File tidak ditemukan"
                );
            }

            let type = "text/plain";

            if (file.endsWith(".html")) {
                type = "text/html";
            } else if (file.endsWith(".css")) {
                type = "text/css";
            } else if (file.endsWith(".js")) {
                type = "text/javascript";
            }

            send(res, 200, type, data);
        });

        return;
    }


    // =========================
    // MENYIMPAN DATA
    // =========================

    if (req.method === "POST" && req.url === "/save") {

        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", async () => {

            try {

                const data = JSON.parse(body);

                const judul = String(data.judul || "");
                const deskripsi = String(data.deskripsi || "");

                const indexPath =
                    path.join(ROOT, "index.html");

                let html =
                    fs.readFileSync(indexPath, "utf8");


                // =========================
                // UBAH JUDUL YANG TERLIHAT
                // =========================

                const headingRegex =
                    /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/i;

                if (headingRegex.test(html)) {

                    html = html.replace(
                        headingRegex,
                        `$1${judul}$3`
                    );

                } else {

                    throw new Error(
                        "Elemen <h1> tidak ditemukan."
                    );
                }


                // =========================
                // UBAH DESKRIPSI
                // =========================

                const markerStart =
                    "<!-- STOVENSA_DESKRIPSI_START -->";

                const markerEnd =
                    "<!-- STOVENSA_DESKRIPSI_END -->";

                if (
                    html.includes(markerStart) &&
                    html.includes(markerEnd)
                ) {

                    const descriptionRegex =
                        new RegExp(
                            markerStart +
                            "[\\s\\S]*?" +
                            markerEnd,
                            "i"
                        );

                    html = html.replace(
                        descriptionRegex,
                        markerStart +
                        "\n<p>" +
                        deskripsi +
                        "</p>\n" +
                        markerEnd
                    );

                } else {

                    html = html.replace(
                        /<\/body>/i,
                        markerStart +
                        "\n<p>" +
                        deskripsi +
                        "</p>\n" +
                        markerEnd +
                        "\n</body>"
                    );
                }


                // =========================
                // SIMPAN INDEX.HTML
                // =========================

                fs.writeFileSync(
                    indexPath,
                    html,
                    "utf8"
                );


                // =========================
                // GIT
                // =========================

                await runGit([
                    "add",
                    "index.html"
                ]);

                try {

                    await runGit([
                        "commit",
                        "-m",
                        "Update website dari Admin Stovensa"
                    ]);

                } catch (commitError) {

                    // Tidak ada perubahan untuk di-commit
                    if (
                        !String(commitError)
                            .includes("nothing to commit")
                    ) {
                        throw commitError;
                    }
                }


                // =========================
                // PUSH KE GITHUB
                // =========================

                await runGit([
                    "push",
                    "origin",
                    "main"
                ]);


                send(
                    res,
                    200,
                    "application/json",
                    JSON.stringify({
                        success: true,
                        message:
                            "Website berhasil diperbarui dan dikirim ke GitHub."
                    })
                );

            } catch (error) {

                console.error(
                    "ERROR:",
                    error
                );

                send(
                    res,
                    500,
                    "application/json",
                    JSON.stringify({
                        success: false,
                        message:
                            "Gagal memperbarui website.",
                        error:
                            String(error)
                    })
                );
            }
        });

        return;
    }


    send(
        res,
        404,
        "text/plain",
        "Not Found"
    );
});


server.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log("");
        console.log("==============================");
        console.log("       ADMIN STOVENSA");
        console.log("==============================");
        console.log(
            "Server: http://127.0.0.1:" + PORT
        );
        console.log("");
    }
);
