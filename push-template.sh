#!/usr/bin/env bash
# Creates github.com/ShivaPrasadAcharya/sarvapustika1.
# Requires the GitHub CLI (https://cli.github.com) logged in: gh auth login
set -e
git init -b main
git config user.name "ShivaPrasadAcharya"
git config user.email "shivaprasadacharya000000000000@gmail.com"
git add -A
git commit -m "Initial sarvapustika1 catalogue"
gh repo create ShivaPrasadAcharya/sarvapustika1 --public --source=. --remote=origin --push \
  --description "Searchable file catalogue for sarvapustika1"
echo "Done: https://github.com/ShivaPrasadAcharya/sarvapustika1"
