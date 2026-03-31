#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

artifact="${1:-}"
require_artifact "$artifact"
doctor_artifact "$artifact"

script_path="$(artifact_phase_script "$artifact" "smoke")"
assert_file_exists "$script_path"

log_section "Smoke artifact: $artifact"
bash "$script_path"
