FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Declare build args
ARG PRIVATE_KEY_1
ARG PRIVATE_KEY_2
ARG APPVIEW_DOMAIN
ARG SAME_TLD_DID
ARG REDIS_PASSWORD

# Make them available to Astro's build step
ENV PRIVATE_KEY_1=$PRIVATE_KEY_1
ENV PRIVATE_KEY_2=$PRIVATE_KEY_2
ENV APPVIEW_DOMAIN=$APPVIEW_DOMAIN
ENV SAME_TLD_DID=$SAME_TLD_DID
ENV REDIS_PASSWORD=$REDIS_PASSWORD

COPY . .
RUN pnpm build

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
