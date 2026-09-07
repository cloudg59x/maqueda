# Use Node.js 20 alpine image
FROM node:20-alpine

# Install OpenSSL libraries required by Prisma
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy all files
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p .next/dev/logs
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js app
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"]