FROM node:18-alpine

# Install dependencies for sharp image processing
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and build
COPY . .
RUN npm run build

ENV PORT=8000
ENV MAX_IMAGE_SIZE=10485760
ENV ALLOWED_DOMAINS=""

# Start the server using stdio
CMD ["node", "dist/index.js"] 