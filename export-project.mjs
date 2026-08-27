import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const src = "/home/daytona/codebase";
const dst = "/tmp/bg-validator-pro";
const excludeDirs = ["node_modules", "dist", "isolate", ".git", "_generated"];
const excludeFiles = [".env.local", "bun.lock", "package-lock.json", "sst-env.d.ts", "main.ts", "integrations.md", "vly-toolbar-readonly.tsx"];

function copyRecursive(from, to) {
  for (const entry of readdirSync(from)) {
    if (excludeDirs.includes(entry) || excludeFiles.includes(entry)) continue;
    const fromPath = join(from, entry);
    const toPath = join(to, entry);
    if (statSync(fromPath).isDirectory()) {
      mkdirSync(toPath, { recursive: true });
      copyRecursive(fromPath, toPath);
    } else {
      copyFileSync(fromPath, toPath);
    }
  }
}

mkdirSync(dst, { recursive: true });
copyRecursive(src, dst);
execSync(`cd /tmp && tar czf /tmp/bg-validator-pro.tar.gz bg-validator-pro`, { stdio: "inherit" });
console.log("DONE: /tmp/bg-validator-pro.tar.gz");
