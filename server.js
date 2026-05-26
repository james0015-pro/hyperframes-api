import express from 'express';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;
const TMP = tmpdir();

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'hyperframes-api', version: '2.0.0' });
});

app.post('/render', async (req, res) => {
  const { html } = req.body;
  
  if (!html) {
    return res.status(400).json({ error: 'Missing "html" in request body' });
  }

  const jobId = randomUUID();
  const jobDir = join(TMP, jobId);

  try {
    mkdirSync(jobDir, { recursive: true });
    console.log(`[${jobId}] Created: ${jobDir}`);

    // Step 1: hyperframes init
    console.log(`[${jobId}] Running hyperframes init...`);
    execSync(`npx hyperframes init ${jobDir} --yes 2>&1 || true`, { 
      timeout: 60000,
      stdio: 'pipe',
      cwd: TMP
    });

    // Step 2: Overwrite index.html with user's composition
    const indexPath = join(jobDir, 'index.html');
    writeFileSync(indexPath, html, 'utf-8');
    console.log(`[${jobId}] HTML written: ${html.length} bytes`);

    // Step 3: Render
    const cmd = `npx hyperframes render`;
    console.log(`[${jobId}] Running: ${cmd}`);
    
    const startTime = Date.now();
    execSync(cmd, { 
      timeout: 300000,
      stdio: 'pipe',
      cwd: jobDir,
      env: { ...process.env }
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${jobId}] Render done in ${elapsed}s`);

    // Find output MP4
    const outDir = join(jobDir, 'out');
    const mp4Path = join(outDir, 'root.mp4');
    
    if (!existsSync(mp4Path)) {
      // Try listing out directory
      if (existsSync(outDir)) {
        const fs = await import('fs');
        const files = fs.readdirSync(outDir);
        console.log(`[${jobId}] out/ contents: ${files.join(', ')}`);
      }
      throw new Error(`MP4 not found at ${mp4Path}`);
    }

    const videoBuffer = readFileSync(mp4Path);
    const fileSizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);
    console.log(`[${jobId}] MP4 ready: ${fileSizeMB} MB`);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="video-${jobId.slice(0,8)}.mp4"`);
    res.setHeader('X-Render-Time', `${elapsed}s`);
    res.send(videoBuffer);

  } catch (err) {
    console.error(`[${jobId}] ERROR:`, err.message);
    const stderr = err.stderr ? err.stderr.toString().substring(0, 800) : '';
    res.status(500).json({ 
      error: 'Render failed', 
      message: err.message.substring(0, 300),
      stderr 
    });
  } finally {
    // Cleanup
    try { rmSync(jobDir, { recursive: true, force: true }); } catch(e) {}
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 HyperFrames API v2 running on port ${PORT}`);
});
