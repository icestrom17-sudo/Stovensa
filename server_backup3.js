const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 3000;
const ROOT = __dirname;

function runGit(args) {
    return new Promise((resolve, reject) => {
        execFile(
            "git",
            args,
            { cwd: ROOT },
            (error, stdout, stderr) => {

                if (error) {
                    reject(
                        stderr ||
                        stdout ||
                        error.message
                    );
                    return;
                }

                resolve(stdout);
            }
        );
    });
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type":
            "application/json; charset=utf-8"
    });

    res.end(
        JSON.stringify(data)
    );
}

function sendFile(res, filePath) {

    fs.readFile(
        filePath,
        (error, data) => {

            if (error) {
                res.writeHead(404);
                res.end("File tidak ditemukan.");
                return;
            }

            let type = "text/plain";

            if (
                filePath.endsWith(".html")
            ) {
                type = "text/html";
            }

            if (
                filePath.endsWith(".css")
            ) {
                type = "text/css";
            }

            if (
                filePath.endsWith(".js")
            ) {
                type = "text/javascript";
            }

            res.writeHead(200, {
                "Content-Type":
                    type + "; charset=utf-8"
            });

            res.end(data);
        }
    );
}


const server =
http.createServer(
    (req, res) => {

        /*
         * ADMIN
         */

        if (
            req.method === "GET" &&
            req.url === "/"
        ) {

            return sendFile(
                res,
                path.join(
                    ROOT,
                    "admin.html"
                )
            );
        }


        /*
         * SIMPAN DATA
         */

        if (
            req.method === "POST" &&
            req.url === "/save"
        ) {

            let body = "";

            req.on(
                "data",
                chunk => {
                    body += chunk;
                }
            );

            req.on(
                "end",
                async () => {

                    try {

                        const data =
                            JSON.parse(body);

                        const judul =
                            String(
                                data.judul || ""
                            );

                        const deskripsi =
                            String(
                                data.deskripsi || ""
                            );

                        const beritaJudul =
                            String(
                                data.beritaJudul || ""
                            );

                        const beritaIsi =
                            String(
                                data.beritaIsi || ""
                            );


                        /*
                         * BACA WEBSITE
                         */

                        const indexPath =
                            path.join(
                                ROOT,
                                "index.html"
                            );

                        let html =
                            fs.readFileSync(
                                indexPath,
                                "utf8"
                            );


                        /*
                         * JUDUL UTAMA
                         */

                        if (judul) {

                            const headingRegex =
                                /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/i;

                            html =
                                html.replace(
                                    headingRegex,
                                    `$1${judul}$3`
                                );
                        }


                        /*
                         * DESKRIPSI
                         */

                        if (deskripsi) {

                            const markerStart =
                                "<!-- STOVENSA_DESKRIPSI_START -->";

                            const markerEnd =
                                "<!-- STOVENSA_DESKRIPSI_END -->";

                            const blockRegex =
                                new RegExp(
                                    markerStart +
                                    "[\\s\\S]*?" +
                                    markerEnd,
                                    "i"
                                );

                            const block =
                                markerStart +
                                "\n<p>" +
                                deskripsi +
                                "</p>\n" +
                                markerEnd;

                            if (
                                blockRegex.test(html)
                            ) {

                                html =
                                    html.replace(
                                        blockRegex,
                                        block
                                    );

                            } else {

                                html =
                                    html.replace(
                                        /<\/body>/i,
                                        block +
                                        "\n</body>"
                                    );
                            }
                        }


                        /*
                         * BERITA
                         */

                        if (
                            beritaJudul ||
                            beritaIsi
                        ) {

                            const berita =
                                `
<div class="card">
    <div class="icon">📰</div>
    <h3>${beritaJudul}</h3>
    <p>${beritaIsi}</p>
</div>
`;

                            const beritaMarker =
                                "<!-- STOVENSA_BERITA -->";

                            if (
                                html.includes(
                                    beritaMarker
                                )
                            ) {

                                html =
                                    html.replace(
                                        beritaMarker,
                                        beritaMarker +
                                        berita
                                    );

                            } else {

                                html =
                                    html.replace(
                                        "</section>",
                                        berita +
                                        "\n</section>"
                                    );
                            }
                        }


                        /*
                         * SIMPAN
                         */

                        fs.writeFileSync(
                            indexPath,
                            html,
                            "utf8"
                        );


                        /*
                         * GIT ADD
                         */

                        await runGit([
                            "add",
                            "index.html"
                        ]);


                        /*
                         * GIT COMMIT
                         */

                        try {

                            await runGit([
                                "commit",
                                "-m",
                                "Update Stovensa dari Admin"
                            ]);

                        } catch (commitError) {

                            const message =
                                String(
                                    commitError
                                );

                            if (
                                !message.includes(
                                    "nothing to commit"
                                )
                            ) {
                                throw commitError;
                            }
                        }


                        /*
                         * GIT PUSH
                         */

                        await runGit([
                            "push",
                            "origin",
                            "main"
                        ]);


                        sendJSON(
                            res,
                            200,
                            {
                                success: true,
                                message:
                                    "Berhasil memperbarui Stovensa."
                            }
                        );


                    } catch (error) {

                        console.error(
                            error
                        );

                        sendJSON(
                            res,
                            500,
                            {
                                success: false,
                                message:
                                    "Gagal memperbarui Stovensa.",
                                error:
                                    String(error)
                            }
                        );
                    }

                }
            );

            return;
        }


        /*
         * FILE LAIN
         */

        if (
            req.method === "GET"
        ) {

            let requested =
                req.url.split("?")[0];

            if (
                requested === "/"
            ) {
                requested =
                    "/admin.html";
            }

            const filePath =
                path.join(
                    ROOT,
                    requested
                );

            if (
                filePath.startsWith(ROOT)
            ) {

                return sendFile(
                    res,
                    filePath
                );
            }
        }


        res.writeHead(404);
        res.end(
            "Tidak ditemukan."
        );
    }
);


server.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log("");
        console.log(
            "=============================="
        );

        console.log(
            "      ADMIN STOVENSA"
        );

        console.log(
            "=============================="
        );

        console.log(
            "http://127.0.0.1:" +
            PORT
        );

        console.log("");
    }
);
