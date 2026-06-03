#!/usr/bin/env bash
# Runs INSIDE the GCE VM. Installs KVM, Vagrant + libvirt plugin, clones GOAD.
# After this finishes, you log out, log back in (to pick up libvirt group),
# then run `./goad.sh` interactively.
#
# Idempotent: safe to re-run.
set -euo pipefail

echo ">> Updating apt..."
sudo apt-get update -y
sudo apt-get install -y \
    qemu-kvm libvirt-daemon-system libvirt-clients \
    bridge-utils virtinst libguestfs-tools cpu-checker \
    vagrant git python3-venv python3-pip curl \
    ruby-dev gcc make pkg-config \
    libvirt-dev libxml2-dev libxslt-dev zlib1g-dev

echo ">> Adding $USER to libvirt + kvm groups..."
sudo usermod -aG libvirt,kvm "$USER"

echo ">> Sanity-checking nested virtualization..."
if egrep -qo '(vmx|svm)' /proc/cpuinfo; then
    echo "   OK: VMX/SVM exposed."
else
    echo "   FAIL: nested virt NOT exposed. The VM was created without"
    echo "   --enable-nested-virtualization. Re-run create-vm.sh."
    exit 1
fi
sudo kvm-ok || true

echo ">> Installing Vagrant plugins (libvirt + winrm)..."
vagrant plugin install vagrant-libvirt vagrant-reload \
    winrm winrm-fs winrm-elevated 2>&1 | tail -20

echo ">> Cloning GOAD..."
if [ ! -d "$HOME/GOAD" ]; then
    git clone --depth=1 https://github.com/Orange-Cyberdefense/GOAD.git "$HOME/GOAD"
fi

echo ">> All deps installed."
cat <<EOF

================================================================
DONE. Now:

  1. Log out and back in (so libvirt group takes effect):
       exit
       gcloud compute ssh <INSTANCE_NAME> --zone=<ZONE> ...

  2. Inside, kick off GOAD (interactive):
       cd ~/GOAD
       ./goad.sh

     Pick:
       install -> lab: GOAD (or GOAD-Light to save 30% time)
                  provider: libvirt
                  method: ansible

  3. Wait 3-5 hr (KVM is faster than VirtualBox).

  4. Verify all 5 VMs up:
       cd ~/GOAD
       vagrant status

  5. From your laptop, SSH-tunnel to the lab's internal network:
       gcloud compute ssh <INSTANCE_NAME> --zone=<ZONE> \\
           -- -L 13389:192.168.56.10:3389 \\
              -L 5985:192.168.56.22:5985

     Then point apt_gpt_agent.py at 127.0.0.1:5985 with vagrant/vagrant.
================================================================
EOF
