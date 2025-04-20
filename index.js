const http = require("http")
const express = require("express")
const {Server: SocketServer} = require("socket.io")
const pty = require("node-pty");
const fs = require("fs/promises");
const path = require("path")
const cors = require("cors");

const ptyProcess = pty.spawn('bash', [], {
    name: 'xterm-color',
    cwd: process.env.INIT_CWD + "/users",
    env: process.env,
});

const app = express()
app.use(cors());
const server = http.createServer(app);

const io = new SocketServer({
    cors: "*"
})

io.attach(server);
ptyProcess.onData(async data => { 
    io.emit("terminal:data", (data))
    const fileTree = await generateFileTree("./users");
    io.emit("files", ({ tree: fileTree }));
})



io.on("connection", (socket) => {
    console.log("Socket Connected:", socket.id);
    socket.on("terminal:write", (data) => {
        ptyProcess.write(data+'\r');
        // ptyProcess.write("pwd\r")
    })
    socket.on("file:write", (data) => {
        const fileData = JSON.parse(data);
        console.log(fileData);
        
        const {path, content} = fileData;
        fs.writeFile("./users/"+path, content);
    })
})

app.get("/files", async (req, res) => {
    const fileTree = await generateFileTree("./users");
    return res.json({ tree: fileTree })
})

app.get('/files/content', async (req, res) => {
    const path = req.query.path;
    const content = await fs.readFile(`./users/${path}`, 'utf-8')
    return res.json({ content })
})

server.listen(8080, () => {
    console.log("Server running on PORT:", 8080);
})

async function generateFileTree(directory) {
    const tree = {}

    async function buildTree(currentDir, currentTree) {
        const files = await fs.readdir(currentDir)

        for (const file of files) {
            const filePath = path.join(currentDir, file)
            const stat = await fs.stat(filePath)

            if (stat.isDirectory()) {
                currentTree[file] = {}
                await buildTree(filePath, currentTree[file])
            } else {
                currentTree[file] = null
            }
        }
    }

    await buildTree(directory, tree);
    return tree
}