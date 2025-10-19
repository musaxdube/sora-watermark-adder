import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ 
    status: "healthy", 
    timestamp: Date.now(),
    message: "🎬 Sora Watermark API is running!"
  });
}
