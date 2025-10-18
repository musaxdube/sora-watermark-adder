import express from "express";
import type { Request, Response, NextFunction } from 'express';
import multer from "multer"; 
import { exec} from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

const app = express();
const upload = multer({ dest: "uploads/"});

const execAsync = (cmd: string) =>
    new Promise<void>((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(err);
            resolve();
        });
    });

["processing", "uploads", "norm", "outputs"].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

app.use(cors());

app.get("/progress/:id", (req: Request, res: Response) => {
  const progressFile = `processing/${req.params.id}.json`;
  if (!fs.existsSync(progressFile)) return res.json({ status: "Unknown", percent: 0 });
  const data = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
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


app.post("/upload", upload.single("video"), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "No video uploaded" });

    const mainInput = req.file.path;
    const wmInput = "sorawatermark.mp4";
    const normMain = "norm/norm_main.mp4";
    const normWM = "norm/norm_wm.mp4";
    const outputPath = "outputs/final.mp4";

    const fileId = uuidv4();
    const progressFile = `https://sora-watermark-adder.vercel.app/processing/${fileId}.json`;

    fs.writeFileSync(progressFile, JSON.stringify({ status: "Starting...", percent: 0 }));

    const qoute = (p: string) => `"${p}"`;

    try {
        
        await execAsync(`ffmpeg -y -i "${mainInput}" -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" "${normMain}"`);
        if (!fs.existsSync(wmInput)) throw new Error("Watermark not found");
        await execAsync(`ffmpeg -y -i "${wmInput}" -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" "${normWM}"`);

        
        const blend = `
        ffmpeg -y -stream_loop -1 -i ${qoute(normWM)} -i ${qoute(normMain)} \
        -filter_complex "[0:v]colorkey=black:0.3:0.1[wm];[1:v][wm]overlay=0:0:shortest=1[v]" \
        -map "[v]" -map 1:a? -shortest -preset fast -c:a copy ${qoute(outputPath)} -progress pipe:1 -nostats
        `;
        const ff = exec(blend);

        ff.stdout?.on("data", (data: string) => {
            const match = data.match(/out_time_ms=(\d+)/);
            if (match && match[1]) {
                const outTime = parseInt(match[1], 10);
                const percent = Math.min(100, Math.floor((outTime / 60000) * 100));
                fs.writeFileSync(progressFile, JSON.stringify({ status: "Processing...", percent }));
            }
        });

        ff.on("close", () => {
            fs.writeFileSync(progressFile, JSON.stringify({ status: "Done", percent: 100 }));
            
            [mainInput, normMain, normWM].forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
        });

        ff.on("error", (err) => {
            fs.writeFileSync(progressFile, JSON.stringify({ status: "Error", percent: 0, error: err.message }));
            console.error("FFmpeg process error:", err.message);
        });

       
        res.json({ fileId, message: "Processing started, track progress at /progress/:id" });

    } catch (err: any) {
        console.error("Video processing error:", err.message);
        if (!res.headersSent)
            res.status(500).json({ error: "Video processing failed", details: err.message });
    }
});


app.use(cors());


app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});