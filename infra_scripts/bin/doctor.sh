#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra_scripts/lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

artifact="${1:-}"

if [[ -z "$artifact" ]]; then
  doctor_all
else
  doctor_artifact "$artifact"
fi

log_info "Doctor checks passed"
