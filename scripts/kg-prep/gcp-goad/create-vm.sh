#!/usr/bin/env bash
# Spin up a GCE VM sized for running GOAD with nested KVM.
#
# Prereqs: gcloud auth login + project set, .env sourced.
# Cost: ~$0.97/hr on-demand for n2-standard-16 + ~$0.03/hr for 250 GB pd-ssd.
set -euo pipefail

: "${PROJECT_ID:?source .env first}"
: "${ZONE:?source .env first}"
: "${INSTANCE_NAME:?source .env first}"
: "${MACHINE_TYPE:?source .env first}"
: "${DISK_SIZE_GB:?source .env first}"
: "${NETWORK_TAG:?source .env first}"

echo ">> Creating instance $INSTANCE_NAME in $ZONE (project $PROJECT_ID)..."

gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size="${DISK_SIZE_GB}GB" \
    --boot-disk-type=pd-ssd \
    --enable-nested-virtualization \
    --min-cpu-platform="Intel Cascade Lake" \
    --tags="$NETWORK_TAG" \
    --scopes=cloud-platform

echo ">> Allowing your current IP to SSH..."
MY_IP=$(curl -fsS https://ifconfig.me || echo "0.0.0.0")
gcloud compute firewall-rules create "${NETWORK_TAG}-ssh-${USER}" \
    --project="$PROJECT_ID" \
    --network=default --direction=INGRESS \
    --action=ALLOW --rules=tcp:22 \
    --source-ranges="${MY_IP}/32" \
    --target-tags="$NETWORK_TAG" 2>/dev/null || \
    echo "   (firewall rule already exists, skipping)"

EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
    --zone="$ZONE" --project="$PROJECT_ID" \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

cat <<EOF

================================================================
VM up. External IP: $EXTERNAL_IP

Next:
  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID

Inside the VM, copy provision-deps.sh over and run it:
  scp ./provision-deps.sh ${INSTANCE_NAME}:~/
  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID \\
      --command='bash ~/provision-deps.sh'

When done for the day:
  ./stop-vm.sh        # free compute charges, keeps disk (~\$7.5/mo)
  ./destroy-vm.sh     # full delete, nothing left
================================================================
EOF
