import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import serverless from "serverless-http";

// Lazy load ffmpeg to reduce cold start time
let ffmpegPath: string | null = null;
const getFfmpegPath = async () => {
  if (!ffmpegPath) {
    const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
    ffmpegPath = ffmpegInstaller.default.path;
  }
  return ffmpegPath;
};

const app = express();
app.use(cors());

const upload = multer({ dest: "/tmp/uploads/" });

const execAsync = (cmd: string) =>
  new Promise<void>((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });

// Ensure folders exist in /tmp (only temporary storage works on Vercel)
["/tmp/processing", "/tmp/norm", "/tmp/outputs"].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

app.get("/", (_, res) => {
  res.json({ status: "🎬 Sora Watermark API is running!", timestamp: Date.now() });
});

// Health check endpoint for faster response
app.get("/health", (_, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

app.get("/progress/:id", (req: Request, res: Response) => {
  const progressFile = `/tmp/processing/${req.params.id}.json`;
  if (!fs.existsSync(progressFile))
    return res.json({ status: "Unknown", percent: 0 });
  const data = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
  res.json(data);
});

app.get("/download/:fileId", (req: Request, res: Response) => {
  const outputPath = `/tmp/outputs/final_${req.params.fileId}.mp4`;
  if (!fs.existsSync(outputPath))
    return res.status(404).json({ error: "File not found" });
  res.download(outputPath, "watermarked.mp4");
});

app.post("/upload", upload.single("video"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No video uploaded" });

  const ffmpegPath = await getFfmpegPath();
  const fileId = uuidv4();
  const mainInput = req.file.path;
  const wmInput = path.join(process.cwd(), "api/sorawatermark.mp4");
  const normMain = `/tmp/norm/norm_main_${fileId}.mp4`;
  const normWM = `/tmp/norm/norm_wm_${fileId}.mp4`;
  const outputPath = `/tmp/outputs/final_${fileId}.mp4`;
  const progressFile = `/tmp/processing/${fileId}.json`;

  fs.writeFileSync(progressFile, JSON.stringify({ status: "Starting...", percent: 0 }));

  const q = (p: string) => `"${p}"`;

  try {
    // Optimize: Use faster presets and reduce quality for faster processing
    await execAsync(`${ffmpegPath} -y -i ${q(mainInput)} -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" -preset ultrafast ${q(normMain)}`);
    if (!fs.existsSync(wmInput)) throw new Error("Watermark not found");
    await execAsync(`${ffmpegPath} -y -i ${q(wmInput)} -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" -preset ultrafast ${q(normWM)}`);

    // Optimize: Use faster encoding settings
    const blend = `${ffmpegPath} -y -stream_loop -1 -i ${q(normWM)} -i ${q(normMain)} \
    -filter_complex "[0:v]colorkey=black:0.3:0.1[wm];[1:v][wm]overlay=0:0:shortest=1[v]" \
    -map "[v]" -map 1:a? -shortest -preset ultrafast -crf 28 -c:a copy ${q(outputPath)} -progress pipe:1 -nostats`;

    const ff = exec(blend);

    ff.stdout?.on("data", (data: string) => {
      const match = data.match(/out_time_ms=(\d+)/);
      if (match && match[1]) {
        const percent = Math.min(100, Math.floor((parseInt(match[1]) / 60000) * 100));
        fs.writeFileSync(progressFile, JSON.stringify({ status: "Processing...", percent }));
      }
    });

    ff.on("close", () => {
      fs.writeFileSync(progressFile, JSON.stringify({ status: "Done", percent: 100 }));
    });

    ff.on("error", (err) => {
      fs.writeFileSync(progressFile, JSON.stringify({ status: "Error", error: err.message }));
    });

    res.json({ fileId, message: "Processing started", progress: `/progress/${fileId}` });
  } catch (err: any) {
    console.error("Processing failed:", err.message);
    res.status(500).json({ error: "Processing failed", details: err.message });
  }
});

export default serverless(app);
