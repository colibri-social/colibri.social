FROM node:24-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/lib/package.json ./packages/lib/
COPY packages/client/package.json ./packages/client/
COPY apps/website/package.json ./apps/website/

RUN pnpm install --frozen-lockfile

# Declare build args
ARG PRIVATE_KEY_1
ARG PRIVATE_KEY_2
ARG APPVIEW_DOMAIN
ARG SAME_TLD_DID
ARG REDIS_PASSWORD
ARG REDIS_URL
ARG LIVEKIT_API_KEY
ARG LIVEKIT_API_SECRET
ARG LIVEKIT_SERVER_URL
ARG SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ARG INVITE_API_KEY

# Make them available to Astro's build step
ENV PRIVATE_KEY_1=$PRIVATE_KEY_1
ENV PRIVATE_KEY_2=$PRIVATE_KEY_2
ENV APPVIEW_DOMAIN=$APPVIEW_DOMAIN
ENV SAME_TLD_DID=$SAME_TLD_DID
ENV REDIS_PASSWORD=$REDIS_PASSWORD
ENV REDIS_URL=$REDIS_URL
ENV LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
ENV LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
ENV LIVEKIT_SERVER_URL=${LIVEKIT_SERVER_URL}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV INVITE_API_KEY=${INVITE_API_KEY}

COPY packages/ ./packages/
COPY apps/ ./apps/

# Build in dependency order
RUN pnpm --filter @colibri-social/lib build
RUN pnpm --filter @colibri-social/client build
RUN pnpm --filter @colibri-social/website build

FROM node:24-alpine AS runtime
WORKDIR /app

# Root node_modules contains the .pnpm virtual store (actual package files).
# apps/website/node_modules contains pnpm's symlinks into that store.
# Both are needed: Node.js resolves packages by walking up from the entry
# point's path, and the symlinks in apps/website/node_modules are what make
# packages like clsx visible in that traversal.
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/website/dist ./apps/website/dist
COPY --from=base /app/apps/website/node_modules ./apps/website/node_modules
COPY --from=base /app/apps/website/package.json ./apps/website/package.json

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321
CMD ["node", "./apps/website/dist/server/entry.mjs"]
