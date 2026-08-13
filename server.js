const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 3000;
const ROOT = __dirname;

const DATA_DIR =
    path.join(ROOT, "data");

const MEDIA_DIR =
    path.join(ROOT, "media");

const DATA_FILE =
    path.join(
        DATA_DIR,
        "site.json"
    );

const INDEX_FILE =
    path.join(
        ROOT,
        "index.html"
    );


fs.mkdirSync(
    DATA_DIR,
    { recursive:true }
);

fs.mkdirSync(
    MEDIA_DIR,
    { recursive:true }
);


function defaultData(){

    return {

        judul:"STOVENSA",

        deskripsi:
            "Website informasi dan kegiatan Stovensa.",

        berita:[],

        foto:[],

        video:[]

    };

}


function loadData(){

    if(
        !fs.existsSync(
            DATA_FILE
        )
    ){

        return defaultData();

    }

    try{

        return JSON.parse(
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            )
        );

    }catch{

        return defaultData();

    }

}


function saveData(data){

    fs.writeFileSync(

        DATA_FILE,

        JSON.stringify(
            data,
            null,
            2
        ),

        "utf8"

    );

}


function escapeHTML(text){

    return String(text || "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");

}


function createWebsite(data){

    let html =
        fs.readFileSync(
            INDEX_FILE,
            "utf8"
        );


    html =
        html.replace(
            /(<title>)[\s\S]*?(<\/title>)/i,
            `$1${escapeHTML(
                data.judul
            )}$2`
        );


    html =
        html.replace(
            /(<h1[^>]*>)[\s\S]*?(<\/h1>)/i,
            `$1${escapeHTML(
                data.judul
            )}$2`
        );


    html =
        html.replace(
            /(<p id="deskripsi">)[\s\S]*?(<\/p>)/i,
            `$1${escapeHTML(
                data.deskripsi
            )}$2`
        );


    fs.writeFileSync(

        INDEX_FILE,

        html,

        "utf8"

    );

}


function runGit(args){

    return new Promise(
        (resolve,reject)=>{

            execFile(

                "git",

                args,

                {
                    cwd:ROOT
                },

                (
                    error,
                    stdout,
                    stderr
                )=>{

                    if(error){

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

        }
    );

}


async function pushGitHub(){

    await runGit([
        "add",
        "index.html",
        "data",
        "media"
    ]);


    try{

        await runGit([

            "commit",

            "-m",

            "Update Stovensa dari Admin"

        ]);

    }catch(error){

        const message =
            String(error);

        if(
            !message.includes(
                "nothing to commit"
            )
        ){

            throw error;

        }

    }


    await runGit([

        "push",

        "origin",

        "main"

    ]);

}


function send(
    res,
    status,
    type,
    data
){

    res.writeHead(
        status,
        {
            "Content-Type":
                type +
                "; charset=utf-8"
        }
    );

    res.end(data);

}


function sendJSON(
    res,
    status,
    data
){

    send(

        res,

        status,

        "application/json",

        JSON.stringify(data)

    );

}


function receiveBody(req){

    return new Promise(
        (resolve,reject)=>{

            let body="";

            req.on(
                "data",
                chunk=>{

                    body += chunk;

                    if(
                        body.length >
                        70 * 1024 * 1024
                    ){

                        reject(
                            new Error(
                                "Data terlalu besar."
                            )
                        );

                        req.destroy();

                    }

                }
            );


            req.on(
                "end",
                ()=>{

                    try{

                        resolve(
                            JSON.parse(
                                body
                            )
                        );

                    }catch{

                        reject(
                            new Error(
                                "Data tidak valid."
                            )
                        );

                    }

                }
            );


            req.on(
                "error",
                reject
            );

        }
    );

}


const server =
http.createServer(
async(req,res)=>{


    /*
       ADMIN
    */

    if(
        req.method === "GET" &&
        req.url === "/"
    ){

        return send(

            res,

            200,

            "text/html",

            fs.readFileSync(

                path.join(
                    ROOT,
                    "admin.html"
                )

            )

        );

    }


    /*
       DATA
    */

    if(
        req.method === "GET" &&
        req.url === "/api/data"
    ){

        return sendJSON(

            res,

            200,

            loadData()

        );

    }


    /*
       SIMPAN
    */

    if(
        req.method === "POST" &&
        req.url === "/api/save"
    ){

        try{

            const input =
                await receiveBody(
                    req
                );

            const data =
                loadData();


            /*
               WEBSITE
            */

            if(
                input.aksi ===
                "website"
            ){

                data.judul =
                    String(
                        input.judul ||
                        ""
                    );

                data.deskripsi =
                    String(
                        input.deskripsi ||
                        ""
                    );

            }


            /*
               BERITA
            */

            if(
                input.aksi ===
                "tambah_berita"
            ){

                data.berita.unshift({

                    id:Date.now(),

                    judul:
                        String(
                            input.beritaJudul ||
                            ""
                        ),

                    isi:
                        String(
                            input.beritaIsi ||
                            ""
                        )

                });

            }


            if(
                input.aksi ===
                "hapus_berita"
            ){

                data.berita =
                    data.berita.filter(
                        item=>
                            String(
                                item.id
                            ) !==
                            String(
                                input.id
                            )
                    );

            }


            /*
               MEDIA
            */

            if(
                input.aksi ===
                "upload_media"
            ){

                const isVideo =
                    input.type ===
                    "video";


                const base64 =
                    String(
                        input.data ||
                        ""
                    );


                if(
                    !base64
                ){

                    throw new Error(
                        "File kosong."
                    );

                }


                const extension =
                    isVideo
                        ? ".mp4"
                        : ".jpg";


                const filename =
                    Date.now() +
                    "_" +
                    Math.random()
                        .toString(36)
                        .substring(2,8) +
                    extension;


                const relative =
                    "media/" +
                    filename;


                const output =
                    path.join(
                        ROOT,
                        relative
                    );


                const clean =
                    base64.includes(",")
                        ? base64.split(",")[1]
                        : base64;


                fs.writeFileSync(

                    output,

                    Buffer.from(
                        clean,
                        "base64"
                    )

                );


                const item = {

                    id:Date.now(),

                    nama:
                        String(
                            input.nama ||
                            filename
                        ),

                    url:
                        relative

                };


                if(isVideo){

                    data.video.unshift(
                        item
                    );

                }else{

                    data.foto.unshift(
                        item
                    );

                }

            }


            /*
               HAPUS FOTO
            */

            if(
                input.aksi ===
                "hapus_foto"
            ){

                const item =
                    data.foto.find(
                        x=>
                            String(x.id) ===
                            String(input.id)
                    );


                if(item){

                    const file =
                        path.join(
                            ROOT,
                            item.url
                        );

                    if(
                        fs.existsSync(
                            file
                        )
                    ){

                        fs.unlinkSync(
                            file
                        );

                    }

                }


                data.foto =
                    data.foto.filter(
                        x=>
                            String(x.id) !==
                            String(input.id)
                    );

            }


            /*
               HAPUS VIDEO
            */

            if(
                input.aksi ===
                "hapus_video"
            ){

                const item =
                    data.video.find(
                        x=>
                            String(x.id) ===
                            String(input.id)
                    );


                if(item){

                    const file =
                        path.join(
                            ROOT,
                            item.url
                        );

                    if(
                        fs.existsSync(
                            file
                        )
                    ){

                        fs.unlinkSync(
                            file
                        );

                    }

                }


                data.video =
                    data.video.filter(
                        x=>
                            String(x.id) !==
                            String(input.id)
                    );

            }


            /*
               SIMPAN
            */

            saveData(data);


            /*
               UPDATE WEBSITE
            */

            createWebsite(
                data
            );


            /*
               GITHUB
            */

            await pushGitHub();


            return sendJSON(

                res,

                200,

                {

                    success:true,

                    message:
                        "Berhasil disimpan ke GitHub.",

                    data:data

                }

            );


        }catch(error){

            console.error(
                error
            );

            return sendJSON(

                res,

                500,

                {

                    success:false,

                    message:
                        String(
                            error
                        )

                }

            );

        }

    }


    /*
       FILE MEDIA
    */

    if(
        req.method === "GET"
    ){

        const requested =
            decodeURIComponent(
                req.url.split("?")[0]
            );


        if(
            requested.startsWith(
                "/media/"
            )
        ){

            const file =
                path.join(
                    ROOT,
                    requested
                );


            if(
                file.startsWith(
                    MEDIA_DIR
                ) &&
                fs.existsSync(
                    file
                )
            ){

                const ext =
                    path.extname(
                        file
                    ).toLowerCase();


                let type =
                    "application/octet-stream";


                if(
                    ext === ".jpg" ||
                    ext === ".jpeg"
                ){

                    type =
                        "image/jpeg";

                }

                if(
                    ext === ".png"
                ){

                    type =
                        "image/png";

                }

                if(
                    ext === ".webp"
                ){

                    type =
                        "image/webp";

                }

                if(
                    ext === ".mp4"
                ){

                    type =
                        "video/mp4";

                }


                return send(

                    res,

                    200,

                    type,

                    fs.readFileSync(
                        file
                    )

                );

            }

        }

    }


    send(

        res,

        404,

        "text/plain",

        "Tidak ditemukan."

    );

});


server.listen(

    PORT,

    "127.0.0.1",

    ()=>{

        console.log("");
        console.log(
            "=============================="
        );
        console.log(
            "       ADMIN STOVENSA"
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
