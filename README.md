# Colibri

![Let your community spread it's wings](https://github.com/colibri-social/colibri.social/blob/main/public/og.png)

Colibri is an open source chat platform built on the AT protocol for communities big and small. It gives you the ability to create communities, manage members, and communicate through text, voice, and forum channels, all while maintaining true ownership of your data.

Visit us at [colibri.social](https://colibri.social)

## What is Colibri?

You can learn more about Colibri on our [about page](https://colibri.social/about).

## Local Development

### Prerequisites

- Node.js 24.13.0 or higher
- pnpm 10.29.3 or higher
- Redis server (for session management)
- Docker and Docker Compose (optional, for containerized deployment)

### Getting Started

1. Clone the repository:

```bash
git clone https://github.com/colibri-social/colibri.social.git
cd colibri.social
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables by creating a `.env` file:

```bash
# Server-only secrets
PRIVATE_KEY_1=your_private_key_1
PRIVATE_KEY_2=your_private_key_2
INVITE_API_KEY=your_invite_api_key
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
REDIS_PASSWORD=your_redis_password
REDIS_URL=redis://optional_url

# Client-public variables
APPVIEW_DOMAIN=your_appview_domain
LIVEKIT_SERVER_URL=wss://livekit.colibri.social

# Optional
SAME_TLD_DID=optional_did
```

Note: `PRIVATE_KEY_1` and `PRIVATE_KEY_2` must be Base-64 encoded private keys compatible with atproto's libraries.

4. Start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:4321`.

You'll need a local redis instance running alongside the dev server. For this, you can use the docker-compose.dev.yml file.

```bash
pnpm docker:dev
```

### Building for Production

```bash
pnpm build
pnpm start # You need to provide environment variables here for this to work correctly
```

## Contributing

Contributions are welcome! Please feel free to open issues and pull requests.

## License

This project is open source. Please check the LICENSE file for details.

## Future Plans
