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

# Swaps the workspace link for the published client, so the website builds
# against the same artifact npm consumers get
ENV pnpm_config_link_workspace_packages=false
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    CLIENT_VERSION="$(node -p 'require("/app/packages/client/package.json").version')" && \
    pnpm --filter @colibri-social/website add \
      "@colibri-social/client@${CLIENT_VERSION}" \
      --save-exact --yes --store-dir=/pnpm/store

RUN --mount=type=cache,id=astro-cache,target=/app/apps/website/node_modules/.astro \
    --mount=type=cache,id=vite-cache,target=/app/node_modules/.vite \
    pnpm --filter @colibri-social/website build

FROM node:24-alpine AS runtime
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/website/dist ./apps/website/dist
COPY --from=base /app/apps/website/node_modules ./apps/website/node_modules
COPY --from=base /app/apps/website/package.json ./apps/website/package.json

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321
CMD ["node", "./apps/website/dist/server/entry.mjs"]
