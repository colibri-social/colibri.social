# Contributing to Colibri

Contributions of any size are welcome: code, documentation, bug reports, and reviews of open pull requests.

Everything you submit has to be written by you. Read the [AI Contribution Policy](https://github.com/colibri-social/colibri.social/blob/main/AI_POLICY.md) before you open an issue or a pull request.

## Repositories

Colibri lives in two repositories. Open issues and pull requests in the one the change belongs to. If it belongs to both, an issue in the first and a change in both is the way to go!

- [colibri-social/colibri.social](https://github.com/colibri-social/colibri.social): the client, its component library, the native shell, the website, and the docs.
- [colibri-social/api](https://github.com/colibri-social/api): the AppView, the lexicons, and the bridge packages.

## Setting up

Both repositories are pnpm workspaces. Run `corepack enable` to get the pinned pnpm version, then `pnpm install` from the repository root.

The [development overview](https://colibri.social/docs/developers/development/overview) shows how to run the client, an AppView and a PDS together. The [client](https://colibri.social/docs/developers/development/client) and [AppView](https://colibri.social/docs/developers/development/appview) pages cover each repository in detail.

## Making a pull request

1. Make sure an open issue covers the change, and mention its number in the pull request, for example "Closes #123". Typos, broken links and small docs fixes don't need an issue. Same for small fixes in-app.
2. Create a branch from `main` and make your change. Add tests where there is something to assert. [Testing](https://colibri.social/docs/developers/development/testing) explains what belongs where.
3. Run `pnpm lint` and `pnpm test`. The [checks](https://colibri.social/docs/developers/contributing/overview#checks) section lists everything CI runs in each repository.
4. Add a changeset when you changed a package: `pnpm changeset:feature` in the client repository, `pnpm changeset` in the AppView repository.
5. Open the pull request with a title that follows [Conventional Commits](https://www.conventionalcommits.org), such as `fix: keep the draft when a send fails`, and fill in the template.

The [contributing docs](https://colibri.social/docs/developers/contributing/overview) cover changesets, releases and conventions in more depth.

## Reviewing

Reviewing open pull requests and commenting on issues helps as much as code does, and it's a good way to learn a repository.

## Getting help

Ask in the issue you're working on, or mention [@colibri.social](https://bsky.app/profile/colibri.social) on Bluesky.
