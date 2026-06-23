// portability guard: bundle the built artifact for the browser. esbuild errors on
// any unresolved node builtin import, so this fails ci the moment a non-portable
// api sneaks into the sdk. run after `npm run build`.
import { build } from "esbuild";

try {
  await build({
    entryPoints: ["dist/index.js"],
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  console.log("browser bundle ok: zero node polyfills required");
} catch (err) {
  console.error("browser bundle failed — a non-portable (node-only) api is in the build:");
  console.error(err);
  process.exitCode = 1;
}
