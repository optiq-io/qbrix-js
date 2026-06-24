// packaging guard: pack the package exactly as it would be published (dist only,
// per `files`), install the tarball into throwaway esm + cjs projects, and prove
// the public entry resolves at runtime *and* its types resolve under node16
// module resolution for both the `import` (.d.ts) and `require` (.d.cts)
// conditions of the exports map. run after `npm run build`.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tscBin = join(repoRoot, "node_modules", ".bin", "tsc");

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
}

const cleanup = [];
let failed = false;

try {
  // build the publishable tarball; --json reports the exact filename produced.
  const packed = JSON.parse(run("npm", ["pack", "--json", "--silent"], repoRoot));
  const tarball = join(repoRoot, packed[0].filename);
  cleanup.push(() => rmSync(tarball, { force: true }));

  const variants = [
    {
      name: "esm",
      pkgType: "module",
      runFile: "app.mjs",
      runSrc: `import { QbrixClient } from "@optiqio/qbrix";\nif (typeof QbrixClient !== "function") throw new Error("esm: QbrixClient is not a constructor");\nnew QbrixClient({ apiKey: "x" });\nconsole.log("esm import ok");\n`,
      typeFile: "app.mts",
      typeSrc: `import { QbrixClient } from "@optiqio/qbrix";\nconst c: QbrixClient = new QbrixClient({ apiKey: "x" });\nvoid c;\n`,
    },
    {
      name: "cjs",
      pkgType: "commonjs",
      runFile: "app.cjs",
      runSrc: `const { QbrixClient } = require("@optiqio/qbrix");\nif (typeof QbrixClient !== "function") throw new Error("cjs: QbrixClient is not a constructor");\nnew QbrixClient({ apiKey: "x" });\nconsole.log("cjs require ok");\n`,
      typeFile: "app.cts",
      typeSrc: `import { QbrixClient } from "@optiqio/qbrix";\nconst c: QbrixClient = new QbrixClient({ apiKey: "x" });\nvoid c;\n`,
    },
  ];

  for (const v of variants) {
    const dir = mkdtempSync(join(tmpdir(), `qbrix-${v.name}-`));
    cleanup.push(() => rmSync(dir, { recursive: true, force: true }));

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: `consumer-${v.name}`, private: true, type: v.pkgType }, null, 2),
    );
    writeFileSync(join(dir, v.runFile), v.runSrc);
    writeFileSync(join(dir, v.typeFile), v.typeSrc);

    // file: install — no registry, no network; mirrors a real `npm install @optiqio/qbrix`.
    run("npm", ["install", "--no-audit", "--no-fund", "--silent", tarball], dir);

    run("node", [v.runFile], dir);
    // node16 resolution makes tsc honor the exports `types` conditions per file kind.
    run(
      tscBin,
      ["--noEmit", "--strict", "--module", "node16", "--moduleResolution", "node16", v.typeFile],
      dir,
    );

    console.log(`package exports ok: ${v.name} (runtime + types)`);
  }
} catch (err) {
  failed = true;
  console.error("package exports check failed:");
  console.error(err.stdout?.toString() || err.message);
  console.error(err.stderr?.toString() || "");
} finally {
  for (const fn of cleanup.reverse()) {
    try {
      fn();
    } catch {}
  }
}

process.exitCode = failed ? 1 : 0;
