#!/usr/bin/env bash
#
# AI Swarm v3.0.0 - Auth Reset Tool
# Generates commands for the user to manually authenticate workers with Claude Pro/Max
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
WORKERS=()
for i in $(seq 1 $WORKER_COUNT); do
    WORKERS+=("ai-swarm-worker-$i")
done
# v3.0.0: Add Portal (needs auth for Chat)
WORKERS+=("ai-swarm-portal")

echo ""
echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}||${NC}     ${BOLD}AI Swarm v3.0.0 - Claude Pro/Max Authentication${NC}           ${BLUE}||${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo ""
echo -e "Worker count: ${GREEN}${WORKER_COUNT}${NC} + Portal"
echo ""

for worker in "${WORKERS[@]}"; do
    echo -e "${BOLD}> Container: ${BLUE}${worker}${NC}"
    echo -e "  1. Access the container:"
    echo -e "     ${GREEN}docker exec -it ${worker} bash${NC}"
    echo ""
    echo -e "  2. Run Claude login (opens browser):"
    echo -e "     ${GREEN}claude${NC}"
    echo -e "     Then type: ${YELLOW}/login${NC}"
    echo ""
    echo -e "  ${YELLOW}Note: You must have an active Claude Pro or Max subscription.${NC}"
    echo ""
    echo -e "${BLUE}--------------------------------------------------------------------${NC}"
    echo ""
done

echo -e "After authenticating all containers, Claude Code tasks will use your subscription."
echo -e "Check verification status at: ${BOLD}https://${PORTAL_DOMAIN:-localhost:3000}/settings/llm${NC}"
echo ""
echo -e "For troubleshooting, see: ${BOLD}https://${PORTAL_DOMAIN:-localhost:3000}/help/troubleshooting${NC}"
echo ""
