FROM node:20-alpine

WORKDIR /app

# Copy package descriptors first to cache layer
COPY package*.json ./

RUN npm ci

# Copy full source
COPY . .

# Build frontend production assets
RUN npm run build

# Expose backend API (3001), Hocuspocus multiplayer (1234), and Vite preview (4173)
EXPOSE 3001 1234 4173

# By default, run the Express/Hocuspocus backend server
CMD ["node", "server.js"]
