import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Roda a CLI local a partir de backend/ para o Tauri nunca criar um src-tauri/ paralelo.
const cli = fileURLToPath(new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url));
const backend = fileURLToPath(new URL("../../backend/", import.meta.url));
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: backend,
  stdio: "inherit",
});
if (result.error) {
  console.error("Não foi possível iniciar a CLI do Tauri. Execute npm install em frontend/.");
}
process.exit(result.status ?? 1);
