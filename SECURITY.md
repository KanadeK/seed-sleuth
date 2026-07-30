# Security policy

## Supported versions

Security fixes are applied to the newest tagged release. During the `0.x`
series, upgrade to the latest patch before reporting a reproducible issue.

## Report privately

Use GitHub's **Report a vulnerability** flow on the Security tab of
`KanadeK/seed-sleuth`. Do not place exploit details, private generator source,
or proprietary world data in a public issue.

Include the SeedSleuth version, operating system, adapter kind, minimal config,
and whether the issue reproduces with the bundled demo. Remove secrets and
commercial game content.

## Trust boundary

Generator adapters are code chosen by the operator. A module adapter executes
inside a bounded Node worker, while a command adapter starts the exact
executable and argument array in the config. Timeouts and memory limits reduce
accidental damage; they are not a hostile-code sandbox. Only run adapters you
trust, and review pull-request changes before enabling SeedSleuth in CI.

Generated HTML reports are self-contained and escape embedded report data.
They do not load remote scripts, styles, fonts, images, telemetry, or uploads.
World data may still be commercially sensitive, so choose `capture: "none"`
or `"failures"` when artifacts leave a trusted CI environment.
