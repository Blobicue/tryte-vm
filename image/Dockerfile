# ===========================================================================
# Tryte-QOS Standalone Micro-Image
# ===========================================================================
# An ultra-lightweight, high-performance container/OS image hosting the
# Tryte-VM Balanced Ternary Operating System & Quantum Qutrit Gate Compiler.
# ===========================================================================

FROM alpine:3.20 AS builder

# Install build prerequisites
RUN apk add --no-cache \
    gcc \
    musl-dev \
    make \
    linux-headers

WORKDIR /build
COPY quantum/native/vtqpu.c ./

# Compile bit-sliced vector engine with AVX2 optimizations (Zen 3 / 5825U)
# and fallback portable binary
RUN gcc -O3 -mavx2 -march=x86-64-v3 -o vtqpu-avx2 vtqpu.c || \
    gcc -O3 -o vtqpu-avx2 vtqpu.c

# ---------------------------------------------------------------------------
# Final Runtime Stage
# ---------------------------------------------------------------------------
FROM alpine:3.20

LABEL maintainer="Tryte-VM Spark Project <https://github.com/Gaia-0-0-1-1/tryte-vm>"
LABEL description="Tryte-QOS: Balanced Ternary & Topological Quantum Operating System"

# Minimal runtime dependencies: Node.js, bash, iproute2 for cluster discovery
RUN apk add --no-cache \
    nodejs \
    npm \
    bash \
    iproute2 \
    procps

WORKDIR /tryte-qos

# Copy project source files
COPY package.json ./
COPY src/ ./src/
COPY programs/ ./programs/
COPY quantum/ ./quantum/

# Copy compiled native vector engine
COPY --from=builder /build/vtqpu-avx2 ./quantum/native/vtqpu
RUN chmod +x ./quantum/native/vtqpu

# Link CLI executable
RUN chmod +x ./quantum/cli/tsh.js && \
    ln -s /tryte-qos/quantum/cli/tsh.js /usr/local/bin/tsh && \
    ln -s /tryte-qos/quantum/cli/tsh.js /usr/local/bin/qos

# Expose Cluster Peer Discovery UDP Port
EXPOSE 9330/udp
EXPOSE 9331-9345/udp

# Environment
ENV NODE_ENV=production
ENV TRYTE_QOS_MODE=cluster

# Entrypoint boots directly into the Tryte-QOS Shell / Kernel
ENTRYPOINT ["node", "/tryte-qos/quantum/cli/tsh.js"]
