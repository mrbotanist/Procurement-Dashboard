#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 VPS (run as root):
#   bash deploy/setup-server.sh
# Installs Docker, opens only SSH/HTTP/HTTPS in the firewall, adds swap on small
# servers, turns on automatic security updates and sets the timezone.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (or with sudo)."; exit 1; fi

echo "== Updating the system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw unattended-upgrades

echo "== Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "== Firewall: allow SSH, HTTP, HTTPS only"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "== Swap (helps the build on 1–2 GB servers)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Automatic security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Timezone Asia/Dubai (backups run at 02:30 local time)"
timedatectl set-timezone Asia/Dubai || true

echo
echo "Server ready. Next: cd into the app folder and run  bash deploy/deploy.sh your-domain.com"
