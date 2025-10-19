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

// Multer middleware for handling file uploads
const uploadMiddleware = upload.single('video');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Upload request received:', req.method, req.headers);
    
    // Process the file upload
    await new Promise((resolve, reject) => {
      uploadMiddleware(req as any, res as any, (err: any) => {
        if (err) {
          console.error('Multer error:', err);
          reject(err);
        } else {
          console.log('File processed:', req.file ? 'Yes' : 'No');
          resolve(undefined);
        }
      });
    });

    // Check if file was uploaded
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Ensure folders exist in /tmp
    ["/tmp/processing", "/tmp/norm", "/tmp/outputs", "/tmp/uploads"].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    });

    const fileId = uuidv4();
    const tempFilePath = `/tmp/uploads/${fileId}_${req.file.originalname}`;
    
    // Write the uploaded file to temporary storage
    fs.writeFileSync(tempFilePath, req.file.buffer);
    
    // For now, return success response (video processing will be implemented next)
    res.json({ 
      fileId, 
      message: "Video uploaded successfully! Processing will be implemented next.",
      status: "uploaded",
      progress: `/api/progress/${fileId}`
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
}
