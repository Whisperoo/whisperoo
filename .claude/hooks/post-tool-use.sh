#!/bin/bash
# Auto-run bun install after npm/bun package installations
# This hook runs after every tool use in Claude Code

# Check if the last tool was a package installation command
if [[ "$LAST_TOOL_NAME" == "Bash" ]]; then
  # Check if the command was an npm install, bun add, or similar
  if echo "$LAST_TOOL_ARGS" | grep -q "npm install\|bun add\|bun install\|yarn add\|pnpm add"; then
    echo "📦 Package installation detected. Running bun install..."
    bun install
    echo "✅ bun install completed"
  fi
fi
