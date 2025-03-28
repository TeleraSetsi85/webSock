import express from "express";
import path from "path";
import fs from "fs";
import { Server } from "socket.io";
import multer from "multer";
import * as zl from "zip-lib";

const app = express();
const __dirname = path.resolve();
const uploadPath = path.join(__dirname, "public/uploads");

// settings
app.set("port", process.env.PORT || 3000);

// static files
app.use(express.static(path.join(__dirname, "public")));

// multer
const storage = multer.diskStorage({
  destination: uploadPath,
  filename: (req, file, cb) => {
    const uniqueSuffix = getDate() + "_" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// starting the server
const server = app.listen(app.get("port"), () => {
  console.log("Server on: http://localhost:" + app.get("port"));
});

// websockets
const io = new Server(server);
io.on("connection", (socket) => {
  console.log("New connection", socket.id);

  fs.readdir(uploadPath, (err, files) => {
    if (err) {
      console.error("Error reading uploads folder:", err);
      return;
    }

    const images = files.map((file) => `/uploads/${file}`);
    socket.emit("images:all", images);
  });
});

// routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/show", (req, res) => {
  res.sendFile(path.join(__dirname, "public/show.html"));
});

app.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public/upload.html"));
});

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = `/uploads/${req.file.filename}`;

  io.sockets.emit("images:show", filePath);

  res.status(200).json({ message: "Uploaded successfully" });
});

app.get("/download", async (req, res) => {
  try {
    if (!fs.existsSync(uploadPath) || fs.readdirSync(uploadPath).length === 0) {
      return res.status(400).json({ error: "No images available" });
    }

    const zipPath = path.join(uploadPath, "backup.zip");
    zl.archiveFolder(uploadPath, zipPath).then(() => {
      res.download(zipPath, `backup_${getDate()}.zip`, (err) => {
        if (!err) fs.unlinkSync(zipPath);
        else res.status(500).json({ error: "Error downloading the file" });
      });
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Date function
const getDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${month}-${day}-${year}_${hours}-${minutes}-${seconds}`;
};
