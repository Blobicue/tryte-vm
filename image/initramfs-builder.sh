#!/usr/bin/env bash
# ===========================================================================
# initramfs-builder.sh — Bare-Metal Bootable Micro-OS Image for Mini PCs
# ===========================================================================
# Packages Tryte-QOS into a standalone Linux initramfs that can be netbooted
# (PXE) or written to a USB drive to boot AMD Ryzen 7 5825U hardware directly
# into the Balanced-Ternary / Topological Quantum Kernel.
# ===========================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="/tmp/tryte-qos-initramfs"
OUTPUT_DIR="${ROOT_DIR}/dist"

mkdir -p "${WORK_DIR}" "${OUTPUT_DIR}"

echo ">>> Building Tryte-QOS Standalone Micro-OS Initramfs..."

# 1. Prepare root skeleton
rm -rf "${WORK_DIR}/*"
mkdir -p "${WORK_DIR}"/{bin,sbin,dev,proc,sys,etc,usr/bin,usr/lib,tryte-qos,root}

# 2. Generate /init script (PID 1)
cat << 'EOF' > "${WORK_DIR}/init"
#!/bin/sh
# PID 1 for Tryte-QOS Standalone Micro-OS

mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev 2>/dev/null || true

clear
cat << "BANNER"
  _____            _             ___   ___  ____  
 |_   _| __ _   _| |_ ___       / _ \ / _ \/ ___| 
   | || '__| | | | __/ _ \ ____| | | | | | \___ \ 
   | || |  | |_| | ||  __/_____| |_| | |_| |___) |
   |_||_|   \__, |\__\___|      \__\_\\___/|____/ 
            |___/                                 
   Balanced Ternary & Topological Quantum OS (v0.1.0)
BANNER
echo ">>> Booting bare-metal Tryte-QOS kernel..."

# Bring up network interfaces for 12-node cluster discovery
ip link set lo up 2>/dev/null || true
for iface in $(ls /sys/class/net/ 2>/dev/null); do
    if [ "$iface" != "lo" ]; then
        ip link set "$iface" up 2>/dev/null || true
        udhcpc -i "$iface" -n -q -t 2 2>/dev/null || true
    fi
done

echo ">>> Launching Tryte-QOS Shell on /dev/console..."
export PATH="/usr/bin:/bin:/sbin:/tryte-qos/quantum/cli"
cd /tryte-qos

exec /usr/bin/node /tryte-qos/quantum/cli/tsh.js </dev/console >/dev/console 2>&1

# Fallback shell if tsh exits
exec /bin/sh </dev/console >/dev/console 2>&1
EOF

chmod +x "${WORK_DIR}/init"

# 3. Copy Tryte-QOS application files
cp -r "${ROOT_DIR}/package.json" "${WORK_DIR}/tryte-qos/"
cp -r "${ROOT_DIR}/src" "${WORK_DIR}/tryte-qos/"
cp -r "${ROOT_DIR}/quantum" "${WORK_DIR}/tryte-qos/"
cp -r "${ROOT_DIR}/programs" "${WORK_DIR}/tryte-qos/"

# Compile native vector engine if not present
if [ ! -f "${ROOT_DIR}/quantum/native/vtqpu" ]; then
    gcc -O3 -o "${ROOT_DIR}/quantum/native/vtqpu" "${ROOT_DIR}/quantum/native/vtqpu.c"
fi
cp "${ROOT_DIR}/quantum/native/vtqpu" "${WORK_DIR}/tryte-qos/quantum/native/"

# 4. Pack into cpio.gz archive
echo ">>> Packaging CPIO initramfs archive..."
(cd "${WORK_DIR}" && find . -print0 | cpio --null -ov --format=newc | gzip -9) > "${OUTPUT_DIR}/tryte-qos-initramfs.cpio.gz"

echo "==========================================================================="
echo " SUCCESS: Standalone micro-OS initramfs created at:"
echo " ${OUTPUT_DIR}/tryte-qos-initramfs.cpio.gz"
echo ""
echo " Boot command with any standard 64-bit Linux kernel (vmlinuz):"
echo "   qemu-system-x86_64 -kernel /boot/vmlinuz -initrd ${OUTPUT_DIR}/tryte-qos-initramfs.cpio.gz -append \"console=ttyS0\" -nographic"
echo "==========================================================================="
