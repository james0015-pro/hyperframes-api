FROM node:20-slim

# Install Chromium + FFmpeg + fonts for CJK support
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (skip Puppeteer's own Chromium download)
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install

# Copy app
COPY server.js ./

# Expose port
EXPOSE 3000

# Start
CMD ["node", "server.js"]
