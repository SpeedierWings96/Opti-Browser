Requirements for self-hosted Linux runner

- OS: Ubuntu 22.04 or 24.04 recommended
- CPU: 16+ cores (32+ preferred)
- RAM: 32 GB minimum (64 GB preferred)
- Disk: 250 GB free SSD minimum

Setup

1) Register a self-hosted runner on your repo with labels: self-hosted, linux, x64
2) Install base packages:

   sudo apt-get update -y && sudo apt-get install -y \
     python3 python3-venv python3-pip git curl wget pkg-config \
     build-essential ninja-build cmake lld \
     libgtk-3-dev libnss3-dev libasound2-dev libxss-dev libdbus-1-dev \
     libdrm-dev libxkbcommon-dev libxrandr-dev libxcursor-dev libxi-dev \
     libxtst-dev libudev-dev libpci-dev libpulse-dev libkrb5-dev \
     libcups2-dev libxdamage-dev libxshmfence-dev libgbm-dev \
     libegl1-mesa-dev libgles2-mesa-dev libgl1-mesa-dev

3) Ensure outbound HTTPS access to:

   - https://commondatastorage.googleapis.com (toolchains/sysroots)
   - GitHub Releases API

Triggering

- Push a tag like v0.1.0 to run and upload to the release
- Or run workflow_dispatch and provide an optional tag name for artifact files


