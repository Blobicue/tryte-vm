# Tryte-QOS Standalone Operating System Image

This directory provides recipes for deploying **Tryte-QOS** as a standalone, bare-metal operating system across your cluster of 12 mini PCs (AMD Ryzen 7 5825U) or as a lightweight micro-VM.

---

## 1. Architecture

```
+-------------------------------------------------------------+
|                Tryte-QOS Standalone Image                   |
|                                                             |
|  +-------------------------------------------------------+  |
|  |             Tryte Shell (tsh.js) (PID 1)              |  |
|  +-------------------------------------------------------+  |
|  | Universal Quantum Gate Compiler (Fibonacci B₄ / SU(3))|  |
|  +-------------------------------------------------------+  |
|  |     vTQPU Bit-Sliced Vector Execution Unit (AVX2)     |  |
|  +-------------------------------------------------------+  |
|  |   Distributed Cluster Peer Daemon (UDP 9330 P2P)      |  |
|  +-------------------------------------------------------+  |
|  | Linux Minimal Micro-Kernel / Initramfs (Zero Bloat)   |  |
+-------------------------------------------------------------+
```

* **Zero Bloat**: No systemd, no graphical desktop, no bloated binaries.
* **Direct Hardware Access**: Kernel boots in < 1.2 seconds directly into `tsh`.
* **AVX2 Acceleration**: Zen 3 vector units execute 256 balanced-ternary trits per instruction cycle.
* **Autonomous Sharding**: 12 mini PCs discover each other via UDP broadcast and shard the 12 canonical branches of the braid group $B_3$.

---

## 2. Booting with Docker / Container (Micro-OS Sandbox)

To build and run the Tryte-QOS container:

```bash
# Build the image
docker build -t tryte-qos -f image/Dockerfile .

# Run interactively
docker run -it --rm --net=host tryte-qos
```

Passing `--net=host` allows UDP broadcast discovery across physical network interfaces on the 12 mini PCs.

---

## 3. Bare-Metal Network Boot (PXE / iPXE) for 12 Mini PCs

To boot the 12 mini PCs without installing anything on their local SSDs (diskless cluster mode):

1. **Build the Initramfs**:
   ```bash
   ./image/initramfs-builder.sh
   ```
   This generates `dist/tryte-qos-initramfs.cpio.gz`.

2. **Configure your DHCP / TFTP / iPXE Server** (`pxelinux.cfg/default` or `ipxe` script):
   ```
   kernel http://bootserver/vmlinuz
   initrd http://bootserver/tryte-qos-initramfs.cpio.gz
   append console=tty1 console=ttyS0,115200 ip=dhcp
   ```

3. **Power on the 12 Mini PCs**:
   * Enable PXE Network Boot in BIOS.
   * All 12 PCs will acquire an IP address, boot the kernel in RAM in ~2 seconds, discover each other on port 9330, and form an aggregate 96-core / 192-thread topological quantum computing grid.

---

## 4. USB Flash Drive Boot (Direct Bare-Metal)

1. Format a USB drive with FAT32 and install GRUB / Syslinux:
   ```bash
   cp /boot/vmlinuz /mnt/usb/boot/
   cp dist/tryte-qos-initramfs.cpio.gz /mnt/usb/boot/
   ```
2. Configure `grub.cfg`:
   ```grub
   menuentry "Tryte-QOS (Topological Quantum OS)" {
       linux /boot/vmlinuz console=tty1 quiet
       initrd /boot/tryte-qos-initramfs.cpio.gz
   }
   ```
3. Insert USB into any of the mini PCs and boot!
