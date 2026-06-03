#!/usr/bin/env bash
# Stop the VM — no compute charge, disk still billed (~$7.5/mo for 250 GB pd-ssd).
# GOAD state preserved; `start-vm.sh` brings it back in ~30 sec.
set -euo pipefail
: "${PROJECT_ID:?source .env first}"
: "${ZONE:?source .env first}"
: "${INSTANCE_NAME:?source .env first}"

gcloud compute instances stop "$INSTANCE_NAME" \
    --project="$PROJECT_ID" --zone="$ZONE"

echo ">> Stopped. Disk preserved. Run ./start-vm.sh to resume."
