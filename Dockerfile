# Dockerfile

# Stage 1: Install dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only necessary files for installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy package.json files from packages to leverage Docker cache
COPY packages/shared/package.json ./packages/shared/
COPY packages/content-script/package.json ./packages/content-script/
COPY packages/interceptor/package.json ./packages/interceptor/
COPY packages/loadscript/package.json ./packages/loadscript/
COPY packages/popup/package.json ./packages/popup/
COPY packages/service-worker/package.json ./packages/service-worker/
# If you add more packages, copy their package.json too

# Install dependencies using --frozen-lockfile for reproducibility
RUN pnpm install --frozen-lockfile

# Stage 2: Build the extension
FROM deps AS builder
WORKDIR /app

# Copy the rest of the source code
COPY . .

# Run the build command defined in root package.json
RUN pnpm build

# Stage 3: Final image with only the build output
# Use a minimal base image like nginx or even scratch if just serving static files
# Using a simple node image here for simplicity, could be optimized
FROM node:20-slim AS final

WORKDIR /extension_build

# Copy the built extension from the builder stage
COPY --from=builder /app/build .

# (Optional) If you needed to serve the build directory for some reason
# EXPOSE 8080
# CMD ["npx", "serve", "."]

# Default command does nothing, the image just contains the build artifacts
CMD ["echo", "Build artifacts are in /extension_build"]
