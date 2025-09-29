# Use an official Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Create non-root user for runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Prepare upload directory with correct ownership
RUN mkdir -p /app/uploads \\
    && chown -R nodejs:nodejs /app/uploads

# Copy application source
COPY . .

# Switch to non-root user
USER nodejs

# Expose the HTTP port
EXPOSE 3000

# Start the service
CMD ["node", "server.js"]
