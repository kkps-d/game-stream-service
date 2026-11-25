FROM ubuntu:26.04
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 nftables \
    && rm -rf /var/lib/apt/lists/*
COPY --chmod=0755 configure.sh /usr/local/bin/configure-lobby-network
ENTRYPOINT ["/usr/local/bin/configure-lobby-network"]
