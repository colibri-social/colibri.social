# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app

RUN corepack enable

# The image installs from a subset of workspace manifests, so pnpm's pre-run
# dependency check would consider node_modules stale and try to reinstall
ENV pnpm_config_verify_deps_before_run=false

# Copy workspace manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY packages/assets/package.json ./packages/assets/
COPY packages/lib/package.json ./packages/lib/
COPY packages/client/package.json ./packages/client/
COPY apps/website/package.json ./apps/website/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    cd apps/website && pnpm add @colibri-social/client --yes

# Declare build args
ARG APPVIEW_DOMAIN
ARG SAME_TLD_DID

ARG SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_RELEASE
ARG TURSO_AUTH_TOKEN
ARG TURSO_DATABASE_URL
ARG PUBLIC_VAPID_KEY

# Make them available to Astro's build step
ENV APPVIEW_DOMAIN=$APPVIEW_DOMAIN
ENV SAME_TLD_DID=$SAME_TLD_DID

ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}
ENV TURSO_DATABASE_URL=${TURSO_DATABASE_URL}
ENV PUBLIC_VAPID_KEY=${PUBLIC_VAPID_KEY}

COPY packages/ ./packages/
COPY apps/ ./apps/

# Build in dependency order
RUN pnpm --filter @colibri-social/assets build
RUN pnpm --filter @colibri-social/lib build
RUN pnpm --filter @colibri-social/client build
RUN --mount=type=cache,id=astro-cache,target=/app/apps/website/node_modules/.astro \
    --mount=type=cache,id=vite-cache,target=/app/node_modules/.vite \
    pnpm --filter @colibri-social/website build

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
