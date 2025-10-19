import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const progressFile = `/tmp/processing/${id}.json`;
    
    if (!fs.existsSync(progressFile)) {
      return res.json({ status: "Unknown", percent: 0 });
    }

    const data = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
    res.json(data);

  } catch (error: any) {
    console.error("Progress error:", error);
    res.status(500).json({ error: "Failed to get progress", details: error.message });
  }
}
