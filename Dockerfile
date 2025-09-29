# Use an official Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Prepare upload directory with correct ownership
RUN mkdir -p /var/www/public/images && chown -R node:node /var/www/public/images

# Copy application source
COPY --chown=node:node . .

# Switch to non-root user
USER node

# Expose the HTTP port
EXPOSE 3000

# Start the service
CMD ["node", "server.js"]
