#!/usr/bin/env node
// pull the live proxysvc openapi spec into the vendored snapshot.
// the only step that needs a running backend — generation (`npm run generate`)
// works offline from the committed spec/proxysvc.openapi.json.
//
// the spec is filtered to the surface this sdk wraps: the agent hot path plus the
// experiment/pool/policy/gate management routes (the qbrix/admin entry point). auth
// internals, enterprise billing/insight/event routes, and runtime health probes are
// deliberately excluded — they are not part of the public sdk and should not be
// vendored into this open-source repo. grow ALLOWED_PATH_PREFIXES as the sdk surface grows.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_PATH_PREFIXES = [
  "/api/v1/agent",
  "/api/v1/experiments",
  "/api/v1/pools",
  "/api/v1/policies",
  "/api/v1/gates",
];

const baseUrl = (process.env.QBRIX_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const specUrl = `${baseUrl}/openapi.json`;
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../spec/proxysvc.openapi.json");

function isAllowedPath(path) {
  return ALLOWED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// collect every "#/components/<section>/<name>" $ref reachable from a value.
function collectRefs(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, out);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") out.push(child);
      else collectRefs(child, out);
    }
  }
}

// keep only the allowed paths and the components transitively referenced by them.
function filterSpec(spec) {
  const paths = Object.fromEntries(
    Object.entries(spec.paths ?? {}).filter(([path]) => isAllowedPath(path)),
  );

  const components = spec.components ?? {};
  const kept = {};
  const seen = new Set();
  const queue = [];
  collectRefs(paths, queue);

  while (queue.length > 0) {
    const ref = queue.shift();
    if (seen.has(ref)) continue;
    seen.add(ref);
    const match = ref.match(/^#\/components\/([^/]+)\/(.+)$/);
    if (!match) continue;
    const [, section, name] = match;
    const definition = components[section]?.[name];
    if (definition === undefined) continue;
    if (!kept[section]) kept[section] = {};
    kept[section][name] = definition;
    collectRefs(definition, queue);
  }

  if (components.securitySchemes) kept.securitySchemes = components.securitySchemes;

  return { ...spec, paths, components: kept };
}

const res = await fetch(specUrl).catch((cause) => {
  throw new Error(`failed to reach ${specUrl} — is proxysvc running?`, { cause });
});
if (!res.ok) {
  throw new Error(`unexpected ${res.status} ${res.statusText} from ${specUrl}`);
}

const spec = filterSpec(await res.json());
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(spec, null, 2)}\n`);

const pathCount = Object.keys(spec.paths).length;
const schemaCount = Object.keys(spec.components.schemas ?? {}).length;
console.log(`wrote ${outPath} from ${specUrl} (${pathCount} paths, ${schemaCount} schemas)`);
