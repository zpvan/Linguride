#!/bin/bash

set -euo pipefail

COMMON_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=infra_scripts/lib/repo.sh
source "$COMMON_LIB_DIR/repo.sh"
# shellcheck source=infra_scripts/lib/log.sh
source "$COMMON_LIB_DIR/log.sh"
# shellcheck source=infra_scripts/lib/artifacts.sh
source "$COMMON_LIB_DIR/artifacts.sh"
# shellcheck source=infra_scripts/lib/preflight.sh
source "$COMMON_LIB_DIR/preflight.sh"

repo_tools_bin_dir() {
  printf '%s/.tools/bin\n' "$REPO_ROOT"
}

run_repo_cmd() {
  local tools_bin_dir

  tools_bin_dir="$(repo_tools_bin_dir)"
  log_info "Running: $*"
  (
    cd "$REPO_ROOT"
    if [[ -d "$tools_bin_dir" ]]; then
      PATH="$tools_bin_dir:$PATH" "$@"
    else
      "$@"
    fi
  )
}

ensure_dir() {
  mkdir -p "$1"
}

reset_dir() {
  rm -rf "$1"
  mkdir -p "$1"
}

assert_file_exists() {
  [[ -f "$1" ]] || die "Expected file not found: $1"
}

assert_dir_exists() {
  [[ -d "$1" ]] || die "Expected directory not found: $1"
}

json_field() {
  local json_file="$1"
  local field_path="$2"

  node - "$json_file" "$field_path" <<'NODE'
const fs = require("fs");

const filePath = process.argv[2];
const fieldPath = process.argv[3];
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

let current = data;
for (const segment of fieldPath.split(".")) {
  current = current?.[segment];
}

if (current === undefined) {
  process.exit(2);
}

if (typeof current === "object") {
  process.stdout.write(JSON.stringify(current));
} else {
  process.stdout.write(String(current));
}
NODE
}

artifact_package_name() {
  local artifact="$1"
  json_field "$(artifact_package_json "$artifact")" "name"
}

artifact_package_version() {
  local artifact="$1"
  json_field "$(artifact_package_json "$artifact")" "version"
}

find_first_file() {
  local search_dir="$1"
  local pattern="$2"
  find "$search_dir" -maxdepth 2 -type f -name "$pattern" -print | head -n 1
}
