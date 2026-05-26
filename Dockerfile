FROM node:22-slim

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

# Install dependencies
RUN npm install

# Copy app
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
