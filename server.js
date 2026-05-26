import express from 'express';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;
const TMP_DIR = tmpdir();

// Health check
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'hyperframes-api', version: '1.0.0' });
});

// Render video from HTML
app.post('/render', async (req, res) => {
  const { html } = req.body;
  
  if (!html) {
    return res.status(400).json({ error: 'Missing "html" in request body' });
  }

  const jobId = randomUUID();
  const htmlPath = join(TMP_DIR, `${jobId}.html`);
  const mp4Path = join(TMP_DIR, `${jobId}.mp4`);

  try {
    // Write HTML to temp file
    writeFileSync(htmlPath, html, 'utf-8');
    console.log(`[${jobId}] HTML written: ${html.length} bytes`);

    // Render with hyperframes CLI
    const cmd = `npx hyperframes render "${htmlPath}" -o "${mp4Path}" --quality 1080p --fps 30`;
    console.log(`[${jobId}] Running: ${cmd}`);
    
    const startTime = Date.now();
    execSync(cmd, { 
      timeout: 300000, // 5 minute timeout
      stdio: 'pipe',
      env: { ...process.env }
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${jobId}] Render done in ${elapsed}s`);

    // Check if file exists
    if (!existsSync(mp4Path)) {
      throw new Error('MP4 file not found after render');
    }

    const videoBuffer = readFileSync(mp4Path);
    const fileSizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);
    console.log(`[${jobId}] MP4 ready: ${fileSizeMB} MB`);

    // Return the video
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="video-${jobId.slice(0,8)}.mp4"`);
    res.setHeader('X-Render-Time', `${elapsed}s`);
    res.send(videoBuffer);

    // Cleanup
    try { unlinkSync(htmlPath); unlinkSync(mp4Path); } catch(e) {}

  } catch (err) {
    console.error(`[${jobId}] ERROR:`, err.message);
    const stderr = err.stderr ? err.stderr.toString().substring(0, 500) : '';
    res.status(500).json({ 
      error: 'Render failed', 
      message: err.message.substring(0, 300),
      stderr 
    });
    
    // Cleanup on error
    try { if (existsSync(htmlPath)) unlinkSync(htmlPath); } catch(e) {}
    try { if (existsSync(mp4Path)) unlinkSync(mp4Path); } catch(e) {}
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 HyperFrames API running on port ${PORT}`);
});
