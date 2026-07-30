# Research and positioning

Research snapshot: **2026-07-30**. Search counts are time-dependent and are
recorded as evidence for project selection, not permanent market claims.

## Problem evidence

The recurring practical failure is not “how do I make a dungeon generator?”
but “how do I find the rare seed where my generator violates a rule?”

- A GameMaker developer explicitly described procedural bugs that occur only
  on specific seeds and the need to exercise thousands of seeds to find them:
  [community thread](https://www.reddit.com/r/gamemaker/comments/1clqn6b).
- Game developers discussing procedural-world bottlenecks emphasized the cost
  of testing and tailoring a system so repeated output remains useful:
  [r/gamedev discussion](https://www.reddit.com/r/gamedev/comments/1djk5hi).
- Property-based testing is designed around checking a general property over
  many generated inputs; a 2026 engineering study describes using it to find
  real defects across established packages:
  [Anthropic research](https://www.anthropic.com/research/property-based-testing).
- The foundational PCG survey frames game content generation as producing
  instances that must satisfy designer constraints:
  [Procedural content generation for games: a survey](https://research.vu.nl/en/publications/procedural-content-generation-for-games-a-survey/).

These sources support the problem. They do not prove that a new repository
will receive a particular number of stars.

## GitHub repository search

The GitHub Search API was queried by stars with repository scope on
2026-07-30.

| Query | Exact repository matches | Highest relevant star count | Observation |
| --- | ---: | ---: | --- |
| `procedural generation testing game` | 17 | 2 | Results were primarily personal generator experiments, not a reusable contract runner. |
| `worldgen testing game` | 3 | 1 relevant | Results were test projects or an unrelated uploaded log. |
| `"procedural content generation" testing framework` | 0 | — | No exact repository result. |
| `procgen quality assurance` | 0 | — | No exact repository result. |
| `game seed fuzzing` | 0 | — | No exact repository result. |
| `procedural map validator` | 3 | 0 game-specific reusable tools | Results were unrelated or game implementations with internal BFS validation. |
| `"SeedSleuth"` | 0 | — | Project name was unused in repository search. |

Example reproducible API query:

<https://api.github.com/search/repositories?q=procedural%20generation%20testing%20game&sort=stars&order=desc&per_page=20>

The npm registry returned `404` for `seed-sleuth` in the same snapshot.

Search has false negatives: descriptions and READMEs may use different terms,
private tools are invisible, and new repositories appear continuously. The
claim is therefore narrow: no mature, highly isomorphic repository appeared
under the recorded high-intent queries.

## Adjacent tools and non-overlap

| Adjacent category | Example | Why SeedSleuth is different |
| --- | --- | --- |
| Procedural generators and editors | Dungeon, terrain, WFC, and map-building libraries | SeedSleuth consumes a generator; it does not generate content for the user. |
| RL environment benchmarks | [OpenAI Procgen](https://github.com/openai/procgen) | Procgen measures agent generalization across game-like environments. SeedSleuth proves structural contracts in a studio's own generated worlds. |
| Generic property-testing libraries | fast-check, Hypothesis, QuickCheck | They generate program inputs and shrink values. SeedSleuth supplies a game-world protocol, graph contracts, seed replay, visual evidence, and CI exits. |
| In-generator BFS checks | A generator retries until an exit is reachable | A local retry can hide a bad seed or infinite loop. SeedSleuth tests output externally and retains the counterexample. |
| Replay/desync forensics | Compare two deterministic simulations frame by frame | SeedSleuth evaluates one generated world's quality; it does not compare timelines or player inputs. |
| Map editors | Author and export levels | SeedSleuth is headless QA and does not edit a level. |

## Local portfolio exclusion

The local project inventory was checked before selection. The following
game-adjacent ideas were explicitly excluded as repeats:

- game-feel recipe tuning and accessibility heuristics;
- deterministic replay/desync comparison and input minimization;
- shader journaling and replayable visual sketches;
- Git-learning tactics;
- regex challenge games and daily repository guessing;
- screenshot pixel comparison;
- Minecraft adventure-map content.

SeedSleuth occupies a different lifecycle point: pre-release quality
contracts over a population of procedurally generated worlds.

## Why it may earn attention

This is a product hypothesis, not a promise of stars:

- the README demonstrates a visually legible broken seed immediately;
- `npm run demo` proves both a passing and failing system without credentials;
- one protocol works with JavaScript modules and any shell-free external
  exporter;
- offline HTML galleries are easy to link in issues and CI artifacts;
- a GitHub Action makes adoption one workflow step;
- zero package dependencies reduce installation and supply-chain friction;
- stable exits and JUnit fit existing CI systems;
- the first release solves a narrow pain completely instead of presenting a
  generic dashboard.

## Deliberate v0.1 limits

- rectangular symbolic grids only;
- four-neighbor movement only;
- no hex, navmesh, 3D voxel, or weighted-cost graph;
- no automatic player or “fun” score;
- no hostile-code sandbox;
- no cloud service, account, telemetry, or hosted world upload;
- no automatic shrinking of a numeric seed, because a smaller integer is not
  necessarily a simpler generated world.

Those constraints keep the release testable. Potential extensions are in
[ROADMAP.md](ROADMAP.md), but they are not represented as shipped behavior.
