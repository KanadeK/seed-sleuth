# Roadmap

The v0.1 contract is intentionally narrow and complete. Roadmap items are
proposals, not shipped features.

## Candidate v0.2

- weighted movement and terrain-cost path contracts;
- assertion groups such as “every key reaches a matching door”;
- import adapters for common tilemap JSON exports;
- a regression-pack command that writes selected seeds without editing config
  by hand;
- report comparison across generator revisions;
- optional deterministic PNG snapshots generated from symbolic worlds.

## Later investigation

- hex-grid topology;
- layered and 3D voxel worlds;
- navmesh summaries exported by engines;
- configurable neighborhood models;
- plugin-defined metrics in a separate, explicitly trusted worker;
- distribution comparison between release candidates;
- seed sampling strategies beyond integer ranges.

## Non-goals

- replacing a game engine or map editor;
- deciding whether generated content is fun;
- hosting proprietary worlds;
- executing untrusted adapters safely;
- using AI-generated scores as release truth;
- silently repairing a generator's output.

New scope should include a protocol fixture, failure case, offline report
evidence, documentation, and a migration story before its schema is accepted.
