#!/usr/bin/env bash
set -euo pipefail

if (( $# > 1 )); then
  printf 'Usage: bash start.sh [host-ipv4-address]\n' >&2
  exit 2
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

host_ip=${1:-}
if [[ -z "$host_ip" ]]; then
  default_gateway=$(ip -4 route show default | awk '$1 == "default" && $2 == "via" && !found++ { print $3 }')
  if [[ -n "$default_gateway" ]]; then
    host_ip=$(ip -4 route get "$default_gateway" | awk '{ for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit } }')
  fi
fi

if [[ -n "$host_ip" ]]; then
  if [[ "$host_ip" == 127.* ]] || ! ip -o -4 address show | awk '{ sub(/\/.*/, "", $4); print $4 }' | grep -Fx -- "$host_ip" >/dev/null; then
    printf 'Use an IPv4 address assigned to a non-loopback interface on this host.\n' >&2
    exit 2
  fi
fi

docker compose up -d --wait coturn

if [[ -n "$host_ip" ]]; then
  relay=$(docker compose ps -q coturn)
  network=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.NetworkID}}{{end}}' "$relay")
  bridge_gateway=$(docker network inspect --format '{{(index .IPAM.Config 0).Gateway}}' "$network")

  # Firefox can bind its TURN socket to the host's LAN address. The internal bridge needs
  # a return route to that one address while the coturn process itself stays unprivileged.
  docker run --rm --network "container:$relay" --cap-drop ALL --cap-add NET_ADMIN \
    --entrypoint ip busybox:1.37.0 -4 route replace "$host_ip/32" via "$bridge_gateway"
fi
