"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const upload = (0, multer_1.default)({ dest: "uploads/" });
const execAsync = (cmd) => new Promise((resolve, reject) => {
    (0, child_process_1.exec)(cmd, (err, stdout, stderr) => {
        if (err)
            return reject(err);
        resolve();
    });
});
["processing", "uploads", "norm", "outputs"].forEach((dir) => {
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir);
});
app.use((0, cors_1.default)());
app.get("/progress/:id", (req, res) => {
    const progressFile = `processing/${req.params.id}.json`;
    if (!fs_1.default.existsSync(progressFile))
        return res.json({ status: "Unknown", percent: 0 });
    const data = JSON.parse(fs_1.default.readFileSync(progressFile, "utf-8"));
    res.json(data);
    // res.send(`
    //     <h1>🎬 Sora Watermark Server</h1>
    //     <p>Upload a video to test:</p>
    //     <form action="/upload" method="post" enctype="multipart/form-data">
    //       <input type="file" name="video" accept="video/*" />
    //       <button type="submit">Upload</button>
    //     </form>
    //   `);
});
app.get("/download/:fileId", (req, res) => {
    res.download(`outputs/final.mp4`, "watermarked.mp4");
});
app.post("/upload", upload.single("video"), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "No video uploaded" });
    const mainInput = req.file.path;
    const wmInput = "sorawatermark.mp4";
    const normMain = "norm/norm_main.mp4";
    const normWM = "norm/norm_wm.mp4";
    const outputPath = "outputs/final.mp4";
    const fileId = (0, uuid_1.v4)();
    const progressFile = `processing/${fileId}.json`;
    fs_1.default.writeFileSync(progressFile, JSON.stringify({ status: "Starting...", percent: 0 }));
    const qoute = (p) => `"${p}"`;
    try {
        await execAsync(`ffmpeg -y -i "${mainInput}" -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" "${normMain}"`);
        if (!fs_1.default.existsSync(wmInput))
            throw new Error("Watermark not found");
        await execAsync(`ffmpeg -y -i "${wmInput}" -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" "${normWM}"`);
        const blend = `
        ffmpeg -y -stream_loop -1 -i ${qoute(normWM)} -i ${qoute(normMain)} \
        -filter_complex "[0:v]colorkey=black:0.3:0.1[wm];[1:v][wm]overlay=0:0:shortest=1[v]" \
        -map "[v]" -map 1:a? -shortest -preset fast -c:a copy ${qoute(outputPath)} -progress pipe:1 -nostats
        `;
        const ff = (0, child_process_1.exec)(blend);
        ff.stdout?.on("data", (data) => {
            const match = data.match(/out_time_ms=(\d+)/);
            if (match && match[1]) {
                const outTime = parseInt(match[1], 10);
                const percent = Math.min(100, Math.floor((outTime / 60000) * 100));
                fs_1.default.writeFileSync(progressFile, JSON.stringify({ status: "Processing...", percent }));
            }
        });
        ff.on("close", () => {
            fs_1.default.writeFileSync(progressFile, JSON.stringify({ status: "Done", percent: 100 }));
            [mainInput, normMain, normWM].forEach((f) => fs_1.default.existsSync(f) && fs_1.default.unlinkSync(f));
        });
        ff.on("error", (err) => {
            fs_1.default.writeFileSync(progressFile, JSON.stringify({ status: "Error", percent: 0, error: err.message }));
            console.error("FFmpeg process error:", err.message);
        });
        res.json({ fileId, message: "Processing started, track progress at /progress/:id" });
    }
    catch (err) {
        console.error("Video processing error:", err.message);
        if (!res.headersSent)
            res.status(500).json({ error: "Video processing failed", details: err.message });
    }
});
app.use((0, cors_1.default)());
exports.default = app;
//# sourceMappingURL=index.js.map