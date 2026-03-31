#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../../lib/common.sh"

artifact="${1:-}"
require_artifact "$artifact"

log_section "Jenkins CI build: $artifact"
bash "$REPO_ROOT/infra_scripts/bin/doctor.sh" "$artifact"
bash "$REPO_ROOT/infra_scripts/bin/bootstrap.sh" "$artifact"
bash "$REPO_ROOT/infra_scripts/bin/build-artifact.sh" "$artifact"
