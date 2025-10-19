import type { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Lazy load ffmpeg to reduce cold start time
let ffmpegPath: string | null = null;
const getFfmpegPath = async () => {
  if (!ffmpegPath) {
    const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
    ffmpegPath = ffmpegInstaller.default.path;
  }
  return ffmpegPath;
};

const execAsync = (cmd: string) =>
  new Promise<void>((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });

// Configure multer for memory storage (faster for serverless)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure folders exist in /tmp
    ["/tmp/processing", "/tmp/norm", "/tmp/outputs"].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    });

    const ffmpegPath = await getFfmpegPath();
    const fileId = uuidv4();
    
    // For now, return a simple response to test the endpoint
    res.json({ 
      fileId, 
      message: "Upload endpoint is working! Video processing will be implemented next.",
      status: "ready"
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
}
