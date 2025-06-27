# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies
# Copy package.json and package-lock.json (or other lock file)
# Using a wildcard for lock file to be more flexible (npm, yarn, pnpm)
COPY package.json ./
COPY package-lock.json* ./
COPY bun.lockb* ./
# If you have a backend-specific package.json, copy that instead/additionally

# We need the root package.json to get all deps, including backend ones.
# Then, if we had a backend workspace, we'd focus there.
# For now, install all, then prune if possible, or rely on --omit=dev
RUN npm install --omit=dev --ignore-scripts

# Copy backend source code and necessary configuration
COPY tsconfig.json ./
COPY tsconfig.backend.json ./
COPY backend/src ./backend/src
COPY backend/sql ./backend/sql # If needed by the running app, though migrations are better

# Build the backend
RUN npm run build:backend

# Stage 2: Production environment
FROM node:18-alpine

WORKDIR /usr/src/app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist/backend ./dist/backend
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./
# If backend/sql was needed and not bundled, copy it too:
# COPY --from=builder /usr/src/app/backend/sql ./backend/sql

# Expose port (ensure this matches your serverConfig.port and .env BACKEND_PORT)
EXPOSE 3001

# Start the server
# The start:backend script is "node dist/backend/server.js"
CMD [ "npm", "run", "start:backend" ]
