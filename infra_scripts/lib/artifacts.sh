#!/bin/bash

SUPPORTED_ARTIFACTS=(
  "chrome-extension"
)

artifact_exists() {
  local artifact="$1"
  local candidate
  for candidate in "${SUPPORTED_ARTIFACTS[@]}"; do
    if [[ "$candidate" == "$artifact" ]]; then
      return 0
    fi
  done
  return 1
}

require_artifact() {
  local artifact="${1:-}"
  [[ -n "$artifact" ]] || die "Missing artifact id. Use one of: ${SUPPORTED_ARTIFACTS[*]}"
  artifact_exists "$artifact" || die "Unsupported artifact: $artifact"
}

artifact_app_dir() {
  local artifact="$1"
  case "$artifact" in
    chrome-extension)
      printf 'apps/browser-extension\n'
      ;;
    *)
      die "Unsupported artifact: $artifact"
      ;;
  esac
}

artifact_required_os() {
  local artifact="$1"
  case "$artifact" in
    chrome-extension)
      printf 'any\n'
      ;;
    *)
      die "Unsupported artifact: $artifact"
      ;;
  esac
}

artifact_install_workspaces() {
  local artifact="$1"
  case "$artifact" in
    chrome-extension)
      printf 'apps/browser-extension\n'
      printf 'packages/contracts-ts\n'
      ;;
    *)
      die "Unsupported artifact: $artifact"
      ;;
  esac
}

artifact_output_dir() {
  local artifact="$1"
  printf '%s/infra_scripts/out/%s\n' "$REPO_ROOT" "$artifact"
}

artifact_phase_script() {
  local artifact="$1"
  local phase="$2"
  printf '%s/infra_scripts/artifacts/%s/%s.sh\n' "$REPO_ROOT" "$artifact" "$phase"
}

artifact_package_json() {
  local artifact="$1"
  printf '%s/%s/package.json\n' "$REPO_ROOT" "$(artifact_app_dir "$artifact")"
}
