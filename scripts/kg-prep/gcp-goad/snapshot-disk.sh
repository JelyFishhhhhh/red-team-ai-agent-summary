#!/usr/bin/env bash
# Snapshot the boot disk before destroy. Cheap (~$0.026/GB/month for snapshot).
set -euo pipefail
: "${PROJECT_ID:?source .env first}"
: "${ZONE:?source .env first}"
: "${INSTANCE_NAME:?source .env first}"

DISK_NAME=$(gcloud compute instances describe "$INSTANCE_NAME" \
    --zone="$ZONE" --project="$PROJECT_ID" \
    --format='get(disks[0].source)' | xargs basename)

SNAP_NAME="${INSTANCE_NAME}-$(date +%Y%m%d-%H%M)"

gcloud compute disks snapshot "$DISK_NAME" \
    --snapshot-names="$SNAP_NAME" \
    --zone="$ZONE" --project="$PROJECT_ID"

echo ">> Snapshot $SNAP_NAME created."
echo "   To restore later, create disk from snapshot then attach to new VM."
