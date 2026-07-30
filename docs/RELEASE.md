# Release procedure

## Local gate

```bash
npm ci
npm run verify
npm run test:coverage
npm run package
npm run determinism-check
npm run release-check -- --allow-untagged
```

Confirm:

- Git status is clean;
- `git shortlog -sne HEAD` contains only intended contributors;
- commit bodies contain no `Co-authored-by` trailers unless intentionally
  credited and approved;
- package, constants, changelog, citation, and tag versions agree;
- `dist-release/SHA256SUMS.txt` verifies every release asset;
- the clean-install smoke ran the exact `.tgz`;
- the faulty demo still fails for the expected structural reason;
- the healthy demo remains entirely green.

## Tag and push

```bash
git tag -a v0.1.0 -m "SeedSleuth v0.1.0"
node scripts/release-check.mjs
git push origin main
git push origin v0.1.0
```

The tag workflow rebuilds from the tag, reruns all gates, and creates the GitHub
Release from generated assets. Do not upload an earlier local archive to a
different commit.

## Online gate

1. Wait for CI, CodeQL, Pages, and Release workflows to succeed.
2. Verify the public repository default branch and tag point to the intended
   commit.
3. Download every Release asset into a fresh directory.
4. Verify `SHA256SUMS.txt` against the downloads.
5. Install the downloaded `.tgz` in a clean directory.
6. Run `seed-sleuth --version` and `seed-sleuth demo`.
7. Open the public Pages gallery and inspect at least one passing and failing
   world at desktop and narrow widths.
8. Verify GitHub contributors and commit authors show only intended identities.
9. Only then announce the release.

Local artifacts, a tag without a Release, or green CI without downloaded-asset
verification do not close the release.
