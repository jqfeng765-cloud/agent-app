#!/usr/bin/env bash
# Install dsh-better-sidebar into the local web profile.
# Official command: dsh plugin --profile web add dsh-better-sidebar@latest
set -euo pipefail

dsh() {
  if command -v dsh >/dev/null 2>&1; then
    command dsh "$@"
  else
    pnpm dlx @deepseek-ai/dsh "$@"
  fi
}

dsh plugin --profile web add dsh-better-sidebar@latest

profile="${DSH_HOME:-$HOME/.dsh}/profiles/web"
if [[ -d "$profile" ]]; then
  (
    cd "$profile"
    pnpm approve-builds --all
    pnpm rebuild node-pty
  )
  dsh plugin --profile web add dsh-better-sidebar@latest
fi

echo "Installed. Start with: dsh web"
echo "Then hard-refresh the browser (Ctrl/Cmd+Shift+R)."
