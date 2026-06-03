#!/usr/bin/env bash
# Resume a stopped VM. Prints new external IP (changes on restart).
set -euo pipefail
: "${PROJECT_ID:?source .env first}"
: "${ZONE:?source .env first}"
: "${INSTANCE_NAME:?source .env first}"
: "${NETWORK_TAG:?source .env first}"

gcloud compute instances start "$INSTANCE_NAME" \
    --project="$PROJECT_ID" --zone="$ZONE"

# Refresh firewall rule with current IP (ephemeral IPs change).
MY_IP=$(curl -fsS https://ifconfig.me || echo "0.0.0.0")
gcloud compute firewall-rules update "${NETWORK_TAG}-ssh-${USER}" \
    --project="$PROJECT_ID" \
    --source-ranges="${MY_IP}/32" 2>/dev/null || true

EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
    --zone="$ZONE" --project="$PROJECT_ID" \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo ">> Started. External IP: $EXTERNAL_IP"
echo "   Inside, GOAD VMs should still be down — restart them:"
echo "     gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID \\"
echo "         --command='cd ~/GOAD && vagrant up'"
