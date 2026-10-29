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

# 2. Install dependencies
echo "[*] Updating apt packages and installing curl..."
sudo apt-get update -y
sudo apt-get install -y curl tar bzip2 ca-certificates

# 3. Create dedicated system user
if ! id -u stalwart-mail >/dev/null 2>&1; then
    echo "[*] Creating stalwart-mail system user..."
    sudo useradd --system --no-create-home --user-group --shell /usr/sbin/nologin stalwart-mail
fi

# 4. Download and install Stalwart Mail Server (Single Rust binary)
STALWART_VERSION="0.8.5"
ARCH=$(uname -m)

if [ "$ARCH" = "x86_64" ]; then
    STALWART_ARCH="x86_64-unknown-linux-gnu"
elif [ "$ARCH" = "aarch64" ]; then
    STALWART_ARCH="aarch64-unknown-linux-gnu"
else
    echo "[-] Unsupported architecture: $ARCH"
    exit 1
fi

TMP_DIR=$(mktemp -d)
echo "[*] Downloading Stalwart Mail Server v${STALWART_VERSION} for ${ARCH}..."
curl -fsSL "https://github.com/stalwartlabs/mail-server/releases/download/v${STALWART_VERSION}/stalwart-mail-server-${STALWART_ARCH}.tar.gz" -o "${TMP_DIR}/stalwart.tar.gz"

echo "[*] Extracting binary to /usr/local/bin/stalwart-mail..."
sudo tar -xzf "${TMP_DIR}/stalwart.tar.gz" -C /usr/local/bin/
sudo chmod +x /usr/local/bin/stalwart-mail
rm -rf "${TMP_DIR}"

# 5. Prepare directories
sudo mkdir -p /etc/stalwart-mail /var/lib/stalwart-mail /var/log/stalwart-mail
sudo chown -R stalwart-mail:stalwart-mail /var/lib/stalwart-mail /var/log/stalwart-mail /etc/stalwart-mail

# 6. Generate configuration for teamarchon.in if not exists
if [ ! -f /etc/stalwart-mail/config.toml ]; then
    echo "[*] Initializing Stalwart configuration for mx.teamarchon.in..."
    sudo /usr/local/bin/stalwart-mail -c /etc/stalwart-mail/config.toml -init \
        -domain "teamarchon.in" \
        -hostname "mx.teamarchon.in"
    sudo chown stalwart-mail:stalwart-mail /etc/stalwart-mail/config.toml
    sudo chmod 600 /etc/stalwart-mail/config.toml
fi

# 7. Create systemd service with low memory ceiling
cat << 'EOF' | sudo tee /etc/systemd/system/stalwart-mail.service
[Unit]
Description=Stalwart All-In-One Mail Server
After=network.target network-online.target systemd-sysctl.service
Wants=network-online.target

[Service]
Type=simple
User=stalwart-mail
Group=stalwart-mail
ExecStart=/usr/local/bin/stalwart-mail -c /etc/stalwart-mail/config.toml
Restart=on-failure
RestartSec=5
LimitNOFILE=65535

# Strict resource safety bounds for 1GB VPS
MemoryMax=200M
MemoryHigh=160M

ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# 8. Reload systemd and enable service
echo "[*] Reloading systemd daemon..."
sudo systemctl daemon-reload
sudo systemctl enable stalwart-mail.service

echo "=========================================================="
echo " Stalwart Mail Server installation complete!"
echo " Start with: sudo systemctl start stalwart-mail"
echo " Status check: sudo systemctl status stalwart-mail"
echo " Logs check: sudo journalctl -u stalwart-mail -f"
echo "=========================================================="
