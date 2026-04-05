#!/usr/bin/env bash
# PromptFlow — Proxmox VM Provisioning Script
# Creates an Ubuntu 24.04 LTS VM with Docker + Portainer via cloud-init
#
# This VM is designed as a multi-purpose Docker host — PromptFlow is the
# first app, but additional projects can be deployed alongside it.
#
# Usage: ssh root@192.168.1.99 'bash -s' < create-vm.sh
# Or with custom params:
#   ssh root@192.168.1.99 'VMID=200 VM_NAME=docker-host VM_IP=192.168.1.80/24 bash -s' < create-vm.sh

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────
VMID="${VMID:-200}"
VM_NAME="${VM_NAME:-promptflow}"
CORES="${CORES:-4}"
MEMORY="${MEMORY:-8192}"            # MB (8 GB)
DISK_SIZE="${DISK_SIZE:-100G}"
STORAGE="${STORAGE:-local-lvm}"
BRIDGE="${BRIDGE:-vmbr0}"

# Network (static IP)
VM_IP="${VM_IP:-192.168.1.78/24}"
VM_GW="${VM_GW:-192.168.1.1}"
VM_DNS="${VM_DNS:-192.168.1.1 8.8.8.8}"

# Cloud-init user
CI_USER="${CI_USER:-deploy}"
CI_PASSWORD="${CI_PASSWORD:-Martina66}"

# Cloud image — Ubuntu 24.04 Noble Numbat
CLOUD_IMG_URL="https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
CLOUD_IMG_PATH="/var/lib/vz/template/iso/noble-server-cloudimg-amd64.img"

# ─── Functions ──────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ─── Download cloud image if not present ────────────────────────
if [ ! -f "$CLOUD_IMG_PATH" ]; then
    log "Downloading Ubuntu 24.04 cloud image..."
    wget -q --show-progress -O "$CLOUD_IMG_PATH" "$CLOUD_IMG_URL"
else
    log "Cloud image already exists at $CLOUD_IMG_PATH"
fi

# ─── Create cloud-init vendor snippet ──────────────────────────
log "Creating cloud-init vendor config..."
pvesm set local --content images,rootdir,vztmpl,backup,iso,snippets 2>/dev/null || true
mkdir -p /var/lib/vz/snippets

cat > /var/lib/vz/snippets/promptflow-cloud-init.yaml <<CLOUDEOF
#cloud-config
ssh_pwauth: true
chpasswd:
  expire: false
package_update: true
package_upgrade: true
packages:
  - qemu-guest-agent
  - ca-certificates
  - curl
  - gnupg
  - git
runcmd:
  - systemctl enable qemu-guest-agent
  - systemctl start qemu-guest-agent
  # Enable password auth for SSH
  - sed -i "s/^PasswordAuthentication.*/PasswordAuthentication yes/" /etc/ssh/sshd_config.d/*.conf
  - sed -i "s/^PasswordAuthentication.*/PasswordAuthentication yes/" /etc/ssh/sshd_config
  - systemctl restart ssh
  # Install Docker Engine
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \$VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update
  - DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - usermod -aG docker ${CI_USER}
  - systemctl enable docker
  # Deploy Portainer CE
  - docker volume create portainer_data
  - docker run -d -p 9000:8000 -p 9443:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:lts
CLOUDEOF

# ─── Create VM ──────────────────────────────────────────────────
log "Creating VM $VMID ($VM_NAME)..."
qm create "$VMID" \
    --name "$VM_NAME" \
    --cores "$CORES" \
    --memory "$MEMORY" \
    --net0 "virtio,bridge=$BRIDGE" \
    --ostype l26 \
    --scsihw virtio-scsi-single \
    --agent enabled=1

# Import cloud image as boot disk
log "Importing cloud image as boot disk..."
qm set "$VMID" --scsi0 "$STORAGE:0,import-from=$CLOUD_IMG_PATH,discard=on,iothread=1,ssd=1"

# Resize disk
log "Resizing disk to $DISK_SIZE..."
qm resize "$VMID" scsi0 "$DISK_SIZE"

# Add cloud-init drive
log "Configuring cloud-init..."
qm set "$VMID" --ide2 "$STORAGE:cloudinit"
qm set "$VMID" --boot order=scsi0
qm set "$VMID" --ciuser "$CI_USER" --cipassword "$CI_PASSWORD"
qm set "$VMID" --ipconfig0 "ip=$VM_IP,gw=$VM_GW"
qm set "$VMID" --nameserver "$VM_DNS"
qm set "$VMID" --searchdomain local
qm set "$VMID" --serial0 socket --vga serial0
qm set "$VMID" --cicustom "vendor=local:snippets/promptflow-cloud-init.yaml"

# ─── Start VM ──────────────────────────────────────────────────
log "Starting VM $VMID..."
qm start "$VMID"

log "VM $VMID created and started successfully!"
log ""
log "  VM Name:    $VM_NAME"
log "  VM ID:      $VMID"
log "  IP:         ${VM_IP%/*}"
log "  User:       $CI_USER"
log "  CPU:        $CORES cores"
log "  RAM:        $((MEMORY / 1024)) GB"
log "  Disk:       $DISK_SIZE"
log ""
log "  Portainer:  https://${VM_IP%/*}:9443"
log ""
log "Cloud-init will run on first boot (2-5 min). Monitor with:"
log "  ssh $CI_USER@${VM_IP%/*} 'cloud-init status --wait'"
