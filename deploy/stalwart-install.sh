#!/usr/bin/env bash
# ==============================================================================
# Team Archon Mail - Stalwart Mail Server Automated Installer
# Target: Ubuntu 24.04 LTS (1GB RAM Optimized)
# Hostname: mx.teamarchon.in
# Domain: teamarchon.in
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting Stalwart Mail Server Setup for teamarchon.in"
echo "=========================================================="

# 1. Verify resources
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
echo "[*] Total RAM: $((TOTAL_MEM_KB / 1024)) MB"

# Check ports
for port in 25 587 993; do
    if ss -tuln | grep -q ":$port "; then
        echo "[!] WARNING: Port $port is already in use by another service."
        echo "    Run 'sudo ss -tulpn | grep :$port' to inspect."
    fi
done

# 2. Run official Stalwart installer
echo "[*] Downloading official Stalwart installer..."
curl --proto '=https' --tlsv1.2 -sSf https://get.stalw.art/install.sh -o /tmp/stalwart-install.sh
chmod +x /tmp/stalwart-install.sh
sudo sh /tmp/stalwart-install.sh

# 3. Apply memory ceiling to systemd service to protect 1GB VPS & CMSClipper
echo "[*] Applying memory constraints to stalwart systemd service..."
sudo mkdir -p /etc/systemd/system/stalwart.service.d/
cat << 'EOF' | sudo tee /etc/systemd/system/stalwart.service.d/override.conf
[Service]
MemoryMax=200M
MemoryHigh=160M
CPUQuota=80%
EOF

sudo systemctl daemon-reload
sudo systemctl restart stalwart

echo "=========================================================="
echo " Stalwart Mail Server installed and running!"
echo " Status: sudo systemctl status stalwart"
echo " Check bootstrap credentials: sudo journalctl -u stalwart -n 200 | grep -A8 'bootstrap mode'"
echo "=========================================================="
