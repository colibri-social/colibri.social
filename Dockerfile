FROM node:22-alpine AS base
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm build

# Production stage — leaner image
FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
