# Use an official Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Install su-exec for running as non-root
RUN apk add --no-cache su-exec

# Prepare upload directory with correct ownership
RUN mkdir -p /var/www/public/images && chown -R node:node /var/www/public/images

# Copy application source
COPY --chown=node:node . .

# Copy and set permissions for the start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose the HTTP port
EXPOSE 3000

# Start the service
CMD ["/start.sh"]
