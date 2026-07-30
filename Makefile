.PHONY: verify test demo build package release-check determinism-check

verify:
	node scripts/verify.mjs

test:
	node --test

demo:
	node scripts/demo.mjs

build:
	node scripts/build.mjs

package:
	node scripts/package-release.mjs

release-check:
	node scripts/release-check.mjs --allow-untagged

determinism-check:
	node scripts/determinism-check.mjs
