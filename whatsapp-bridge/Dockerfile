FROM node:20-slim

WORKDIR /app

# Install dependencies needed by Node packages (if any)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run the app
CMD ["node", "index.js"]
