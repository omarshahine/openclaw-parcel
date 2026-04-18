#!/usr/bin/env bash
#
# Verify that all plugin version sources agree.
# Exits non-zero if any disagree; prints a table either way.

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required (brew install jq / apt-get install jq)" >&2
  exit 2
fi

read -r v_pkg         < <(jq -r '.version'            package.json)
read -r v_marketplace < <(jq -r '.plugins[0].version' marketplace.json)

printf "%-40s %s\n" "File" "Version"
printf "%-40s %s\n" "----" "-------"
printf "%-40s %s\n" "package.json"       "$v_pkg"
printf "%-40s %s\n" "marketplace.json"   "$v_marketplace"

all="$v_pkg $v_marketplace"
uniq=$(printf '%s\n' $all | sort -u | wc -l | tr -d ' ')

if [ "$uniq" != "1" ]; then
  echo
  echo "FAIL: version sources disagree." >&2
  exit 1
fi

echo
echo "OK: all version sources agree on $v_pkg"
