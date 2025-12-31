#!/usr/bin/env bash
#
# AI Swarm v2 - Manual Authentication Instructions
# Generates commands for the user to manually authenticate workers
#

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

WORKERS=("ai-swarm-portal" "ai-swarm-worker-1" "ai-swarm-worker-2" "ai-swarm-worker-3" "ai-swarm-worker-4")

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     ${BOLD}AI Swarm v2 - Manual Worker Authentication${NC}                ${BLUE}║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "You requested to handle authentication manually. Here are the steps:"
echo ""

for worker in "${WORKERS[@]}"; do
    echo -e "${BOLD}▶ Worker: ${BLUE}${worker}${NC}"
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

echo -e "Once you have authenticated all workers, the swarm is ready."
echo ""
