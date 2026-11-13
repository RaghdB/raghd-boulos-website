#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v python3 >/dev/null 2>&1; then
  print 'Python 3 is required. Install it from python.org and reopen this launcher.'
  read -r '?Press Return to close.'
  exit 1
fi
if command -v gh >/dev/null 2>&1; then
  if ! gh auth status --hostname github.com >/dev/null 2>&1; then
    print 'Connect your GitHub account to publish. Follow GitHub’s sign-in instructions below.'
    gh auth login --hostname github.com --git-protocol https --web
  fi
else
  print 'GitHub CLI is needed only for publishing. Install it from https://cli.github.com/.'
fi
python3 tools/editor.py
