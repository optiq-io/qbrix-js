# Contributing to qbrix-js

Thanks for your interest in contributing to the Qbrix JavaScript/TypeScript SDK! This guide gets you set up.

## Getting started

1. **Fork** the repository and clone your fork.
2. **Install dependencies** (Node 18+):
   ```bash
   npm install
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b feature/short-description
   ```

## Development

The full script surface:

```bash
npm run build        # bundle to dual ESM + CJS + .d.ts (tsup)
npm run dev          # build in watch mode
npm run test         # run the test suite (vitest)
npm run test:watch   # tests in watch mode
npm run coverage     # tests with a coverage report
npm run typecheck    # type-check without emitting (tsc --noEmit)
npm run lint         # lint + format check (biome)
npm run format       # auto-format in place (biome)
```

Before opening a PR, make sure these pass:

```bash
npm run typecheck && npm run lint && npm run test
```

### Wire types

`src/generated.ts` is generated from the vendored proxysvc OpenAPI spec — never edit it by hand. If
the contract changes, refresh and regenerate:

```bash
npm run spec:pull    # pull the latest proxysvc spec into spec/
npm run generate     # regenerate src/generated.ts (CI fails if this is out of sync)
```

### Runtime portability

The SDK is isomorphic and zero-dependency. The smoke matrix proves a `select → feedback` round trip
runs unmodified on Node, Deno, and Bun, plus a browser bundle with no Node polyfills:

```bash
npm run build && npm run smoke && npm run smoke:bundle
```

## Coding standards

- **Zero runtime dependencies**, HTTP/`fetch` only. Use universal primitives (`fetch`,
  `AbortController`); guard any `process` access so the browser/edge bundles stay clean.
- **Public API is camelCase**, mapped over the snake_case wire shape — keep wire types internal.
- **Errors are part of the API**: throw the typed `QbrixError` hierarchy, never bare `Error`s.
- Keep the hot path (`select` / `feedback`) lean; no dead code or speculative abstraction.
- Comment only non-obvious *why*; let names and types carry the rest.

## Changesets

Every user-facing change needs a changeset for versioning and the changelog:

```bash
npx changeset
```

Pick the bump (patch / minor / major) and describe the change in one or two sentences. Commit the
generated file in `.changeset/` alongside your code. Skip this only for changes with no published
impact (CI, docs, internal tooling).

## Commits & pull requests

- **Conventional commits**, lowercase: `feat(transport): …`, `fix(client): …`, `docs(readme): …`.
- Reference the Linear issue id where relevant, e.g. `feat(errors): … (OPT-142)`.
- Keep PRs focused — one logical change each; add tests for new behavior and error paths.
- Open the PR against `main`. The [pull request template](.github/PULL_REQUEST_TEMPLATE.md)
  pre-populates the Summary / Changes / Testing / Out-of-scope sections — fill each one.

## Reporting bugs

Open a [GitHub issue](https://github.com/optiq-io/qbrix-js/issues) with:

- runtime + version (Node/Deno/Bun, OS)
- SDK version (`npm ls qbrix`)
- minimal reproduction steps
- expected vs. actual behavior

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
