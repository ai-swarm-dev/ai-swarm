#!/usr/bin/env bash
#
# AI Swarm v3 - Manual Authentication Instructions
# Generates commands for the user to manually authenticate workers
#

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

# Load env to get WORKER_COUNT
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

WORKER_COUNT="${WORKER_COUNT:-4}"

# Build workers array dynamically
WORKERS=("ai-swarm-portal")
for i in $(seq 1 $WORKER_COUNT); do
    WORKERS+=("ai-swarm-worker-$i")
done

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     ${BOLD}AI Swarm v3.0.0 - Manual Worker Authentication${NC}          ${BLUE}║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "You requested to handle authentication manually. Here are the steps:"
echo -e "Worker count: ${GREEN}${WORKER_COUNT}${NC} + Portal"
echo ""

for worker in "${WORKERS[@]}"; do
    echo -e "${BOLD}▶ Container: ${BLUE}${worker}${NC}"
    echo -e "  Run this command to access the container:"
    echo -e "  ${GREEN}docker exec -it ${worker} bash${NC}"
    echo ""
    echo -e "  Then, inside the container, run your authentication command."
    echo -e "  (e.g., 'gemini auth login' or 'gcloud auth application-default login')"
    echo -e "  ${YELLOW}Note: If 'gemini' is not found, you may need to install it or check your PATH.${NC}"
    echo ""
    echo -e "${BLUE}─────────────────────────────────────────────────────────────────${NC}"
    echo ""
done

echo -e "Once you have authenticated all containers, the swarm is ready."
echo -e "Check verification status at: ${BOLD}https://${PORTAL_DOMAIN:-localhost:3000}/settings/llm${NC}"
echo ""
echo -e "For troubleshooting, see: ${BOLD}https://${PORTAL_DOMAIN:-localhost:3000}/help/troubleshooting${NC}"
echo ""

