import express from "express";
import path from "path";
import fs from "fs";
import { Server } from "socket.io";
import multer from "multer";

const app = express();
const __dirname = path.resolve();

// settings
app.set("port", process.env.PORT || 3000);

// static files
app.use(express.static(path.join(__dirname, "public")));

// multer
const storage = multer.diskStorage({
  destination: path.join(__dirname, "public/uploads"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
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

  const uploadPath = path.join(__dirname, "public/uploads");
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

app.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public/upload.html"));
});

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = `/uploads/${req.file.filename}`;

  io.sockets.emit("images:show", filePath);

  res.json({ message: "Uploaded successfully", file: filePath });
});
