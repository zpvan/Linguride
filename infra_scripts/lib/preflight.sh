#!/bin/bash

detect_os() {
  case "$(uname -s)" in
    Darwin)
      printf 'macos\n'
      ;;
    Linux)
      printf 'linux\n'
      ;;
    MINGW*|MSYS*|CYGWIN*)
      printf 'windows\n'
      ;;
    *)
      printf 'unknown\n'
      ;;
  esac
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "Missing required command: $command_name"
}

command_version() {
  local command_name="$1"
  "$command_name" --version 2>/dev/null | head -n 1 || true
}

print_command_version() {
  local command_name="$1"
  local version
  version="$(command_version "$command_name")"
  if [[ -n "$version" ]]; then
    log_info "$command_name => $version"
  else
    log_info "$command_name => installed"
  fi
}

require_os() {
  local expected="$1"
  local actual
  actual="$(detect_os)"
  if [[ "$expected" != "any" && "$actual" != "$expected" ]]; then
    die "Current OS is $actual, but this artifact requires $expected"
  fi
}

doctor_common() {
  require_command bash
  require_command node
  require_command npm
  print_command_version bash
  print_command_version node
  print_command_version npm
}

doctor_artifact() {
  local artifact="$1"
  require_artifact "$artifact"

  log_section "Doctor: $artifact"
  doctor_common

  case "$artifact" in
    chrome-extension)
      require_command cargo
      require_command rustup
      require_command zip
      print_command_version cargo
      print_command_version rustup
      print_command_version zip
      ;;
    macos-app)
      require_os macos
      require_command cargo
      print_command_version cargo
      ;;
    vscode-extension)
      :
      ;;
  esac
}

doctor_all() {
  local artifact
  for artifact in "${SUPPORTED_ARTIFACTS[@]}"; do
    doctor_artifact "$artifact"
  done
}
