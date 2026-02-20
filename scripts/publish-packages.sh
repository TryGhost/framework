#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN="false"
DIST_TAG="${NPM_DIST_TAG:-latest}"
PACKAGE_FILTER="${PACKAGE_FILTER:-}"

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN="true"
      ;;
    --package=*)
      PACKAGE_FILTER="${arg#*=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./scripts/publish-packages.sh [--dry-run] [--package=@scope/name]" >&2
      exit 1
      ;;
  esac
done

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but was not found in PATH." >&2
  exit 1
fi

echo "Publish mode: $([[ "$DRY_RUN" == "true" ]] && echo "dry-run" || echo "live")"
echo "Dist tag: $DIST_TAG"
if [[ -n "$PACKAGE_FILTER" ]]; then
  echo "Package filter: $PACKAGE_FILTER"
fi
echo

published=0
skipped=0
failed=0

while IFS= read -r package_json; do
  package_dir="$(dirname "$package_json")"
  package_name="$(jq -r '.name' "$package_json")"
  package_version="$(jq -r '.version' "$package_json")"
  package_private="$(jq -r '.private // false' "$package_json")"

  if [[ -n "$PACKAGE_FILTER" && "$package_name" != "$PACKAGE_FILTER" ]]; then
    continue
  fi

  if [[ "$package_private" == "true" ]]; then
    echo "SKIP (private): $package_name"
    skipped=$((skipped + 1))
    continue
  fi

  if npm view "${package_name}@${package_version}" version --registry=https://registry.npmjs.org >/dev/null 2>&1; then
    echo "SKIP (already published): ${package_name}@${package_version}"
    skipped=$((skipped + 1))
    continue
  fi

  echo "PUBLISH: ${package_name}@${package_version}"
  if [[ "$DRY_RUN" == "true" ]]; then
    if (cd "$package_dir" && npm publish --access public --tag "$DIST_TAG" --registry=https://registry.npmjs.org --dry-run); then
      published=$((published + 1))
    else
      failed=$((failed + 1))
    fi
  else
    if (cd "$package_dir" && npm publish --access public --tag "$DIST_TAG" --registry=https://registry.npmjs.org); then
      published=$((published + 1))
    else
      failed=$((failed + 1))
    fi
  fi
done < <(find packages -mindepth 2 -maxdepth 2 -name package.json | sort)

echo
echo "Summary:"
echo "  Published: $published"
echo "  Skipped:   $skipped"
echo "  Failed:    $failed"

if (( failed > 0 )); then
  exit 1
fi
