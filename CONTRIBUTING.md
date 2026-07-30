# Contributing

Thank you for helping SeedSleuth make procedural worlds less mysterious.

## Start here

Requirements: Node.js 20 or newer and Git.

```bash
git clone https://github.com/KanadeK/seed-sleuth.git
cd seed-sleuth
npm ci
npm run verify
```

The project has no runtime or development package dependencies. `npm ci`
still verifies the committed package lock and gives contributors the same
entrypoint used by CI.

## Change expectations

- Add a deterministic fixture for every new contract, parser edge, or failure
  path.
- Keep adapters shell-free. A command adapter receives an argument array and
  must never interpolate a shell command.
- Preserve the stable exit-code meanings documented in the README.
- Keep reports offline: no CDN, analytics, remote font, or report upload.
- Update the JSON schemas and both READMEs when a public contract changes.
- Run `npm run verify`, `npm run package`, and
  `npm run release-check -- --allow-untagged` before requesting release review.

## Pull requests

Describe the generator or world failure being addressed, include a minimal
seed/config fixture, and list the exact commands you ran. Screenshots are
helpful for viewer changes, but do not replace assertions.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Security-sensitive reports belong in the private channel described in
[SECURITY.md](SECURITY.md), not a public issue.
