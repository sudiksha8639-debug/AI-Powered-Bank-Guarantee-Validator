#!/bin/bash
# BG Validator Pro — GitHub Export Script
# Run this from the project root on your Mac

echo "📦 Creating archive..."
tar czf bg-validator-pro.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='isolate' \
  --exclude='.git' \
  --exclude='src/convex/_generated' \
  --exclude='.env.local' \
  --exclude='bun.lock' \
  --exclude='package-lock.json' \
  --exclude='sst-env.d.ts' \
  --exclude='main.ts' \
  --exclude='integrations.md' \
  --exclude='vly-toolbar-readonly.tsx' \
  .

echo "✅ Archive created: bg-validator-pro.tar.gz"
echo ""
echo "Next steps:"
echo "  1. Create a new repo on github.com"
echo "  2. Unzip this archive into the repo folder"
echo "  3. Run: bun install"
echo "  4. Run: bunx convex dev (to set up Convex backend)"
echo "  5. Run: git add . && git commit -m 'Initial' && git push"
