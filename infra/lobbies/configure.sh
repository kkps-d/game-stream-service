#!/bin/sh
set -eu

agent_ip=$1
agent_port=$2
turn_ip=$3
turn_port=$4
has_lobby=$5

ip link show dev stream0 >/dev/null
lobby_input=
lobby_output=
if [ "$has_lobby" = 1 ]; then
    lobby_subnet=$(ip -4 route show dev lobby0 proto kernel scope link | cut -d ' ' -f 1)
    test -n "$lobby_subnet"
    if [ -n "$(ip -4 route show default dev lobby0)" ]; then
        ip -4 route del default dev lobby0
    fi
    ip -4 route replace 224.0.0.0/4 dev lobby0
    ip -4 route replace broadcast 255.255.255.255/32 dev lobby0
    lobby_input="iifname \"lobby0\" ip saddr $lobby_subnet ip daddr { $lobby_subnet, 224.0.0.0/4, 255.255.255.255 } accept"
    lobby_output="oifname \"lobby0\" ip saddr $lobby_subnet ip daddr { $lobby_subnet, 224.0.0.0/4, 255.255.255.255 } accept"
fi

# These rules live in the game namespace. Docker removes them with the namespace.
nft -f - <<RULES
table inet game_stream {
    chain input {
        type filter hook input priority 0; policy drop;
        iifname "lo" accept
        $lobby_input
        iifname "stream0" ct state established,related accept
        iifname "stream0" ip saddr $turn_ip udp sport { $turn_port, 49160-49200 } accept
    }
    chain output {
        type filter hook output priority 0; policy drop;
        oifname "lo" accept
        $lobby_output
        oifname "stream0" ip daddr $agent_ip tcp dport $agent_port accept
        oifname "stream0" ip daddr $turn_ip udp dport { $turn_port, 49160-49200 } accept
    }
}
RULES
