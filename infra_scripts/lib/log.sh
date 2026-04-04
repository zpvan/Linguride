#!/bin/bash

log_timestamp() {
  date +"%Y-%m-%dT%H:%M:%S%z"
}

log_info() {
  printf '[%s] INFO  %s\n' "$(log_timestamp)" "$*"
}

log_warn() {
  printf '[%s] WARN  %s\n' "$(log_timestamp)" "$*" >&2
}

log_error() {
  printf '[%s] ERROR %s\n' "$(log_timestamp)" "$*" >&2
}

log_section() {
  printf '\n[%s] ==== %s ====\n' "$(log_timestamp)" "$*"
}

die() {
  log_error "$*"
  exit 1
}
