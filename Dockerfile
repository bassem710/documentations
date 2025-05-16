# Use Node.js base image
FROM node:20.12-alpine3.19

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install required packages for fonts
RUN apk add --no-cache fontconfig ttf-liberation ttf-dejavu ttf-freefont curl

# Download and install Arial font
RUN mkdir -p /usr/share/fonts/truetype/arial && \
    curl -L https://github.com/matomo-org/travis-scripts/raw/master/fonts/Arial.ttf -o /usr/share/fonts/truetype/arial/Arial.ttf && \
    curl -L https://github.com/matomo-org/travis-scripts/raw/master/fonts/Arial_Bold.ttf -o /usr/share/fonts/truetype/arial/Arial_Bold.ttf && \
    curl -L https://github.com/matomo-org/travis-scripts/raw/master/fonts/Arial_Italic.ttf -o /usr/share/fonts/truetype/arial/Arial_Italic.ttf && \
    curl -L https://github.com/matomo-org/travis-scripts/raw/master/fonts/Arial_Bold_Italic.ttf -o /usr/share/fonts/truetype/arial/Arial_Bold_Italic.ttf

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Create assets directory if it doesn't exist
RUN mkdir -p ./assets

# Copy assets directory
COPY assets ./assets/

# Copy the rest of the application code
COPY . .

# Ensure proper permissions for assets
RUN chmod -R 755 ./assets

# Update font cache
RUN fc-cache -f -v

# Expose the port the app runs on
EXPOSE 8000

# Define the command to start the application
CMD ["npm", "start"]