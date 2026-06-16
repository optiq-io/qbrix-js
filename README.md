<p align="center">
  <strong>qbrix</strong> — JavaScript/TypeScript SDK for the <a href="https://qbrix.io">Qbrix</a> platform.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node >=18">
  <img src="https://img.shields.io/badge/types-included-3178C6?logo=typescript&logoColor=white" alt="TypeScript types included">
</p>

---

A tiny, isomorphic SDK for bandit **selection** and **feedback** — works in the browser, Node 18+, Deno, Bun, and edge runtimes, with zero runtime dependencies.

> 🚧 **Work in progress.** This is the project scaffold (OPT-37). The client, types, and full documentation land in the following tickets — see the [qbrix.js SDK MVP spec](https://linear.app/optiqio/document/qbrixjs-sdk-mvp-spec-8152cd73f83e).

## Development

```bash
npm install
npm run build      # dual ESM + CJS + .d.ts via tsup
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # biome
```

## License

MIT
