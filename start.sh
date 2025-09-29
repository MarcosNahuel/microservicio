#!/bin/sh

# Ensure the upload directory has correct permissions for the node user
if [ -d /var/www/public/images ]; then
  chown -R node:node /var/www/public/images
fi

# Execute the application as the node user
exec su-exec node node server.js