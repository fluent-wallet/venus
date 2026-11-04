#!/bin/bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <marketing_version> <build_number>" >&2
  exit 1
fi

marketing_version="$1"
build_number="$2"

if [[ ! "$build_number" =~ ^[1-9][0-9]*$ ]]; then
  echo "Build number must be a positive integer" >&2
  exit 1
fi

# CNG reads the build number before generating either native project.
if [ -n "${GITHUB_ENV:-}" ]; then
  printf 'APP_BUILD_NUMBER=%s\n' "$build_number" >> "$GITHUB_ENV"
fi
printf 'Version: %s; APP_BUILD_NUMBER=%s\n' "$marketing_version" "$build_number"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  printf '| Version | Build number |\n| --- | --- |\n| %s | %s |\n' \
    "$marketing_version" "$build_number" >> "$GITHUB_STEP_SUMMARY"
fi
