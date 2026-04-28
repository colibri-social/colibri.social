FROM node:24-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
RUN pnpm install

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

COPY . .
RUN pnpm build

FROM node:24-alpine AS runtime
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
