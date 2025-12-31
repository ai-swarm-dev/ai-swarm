#!/usr/bin/env bash
#
# AI Swarm v2 - Auth Reset Tool
# "Panic Button": Forces workers back into Maintenance Mode (sleep infinity)
#

set -e
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}AI Swarm v2 - Auth Recovery${NC}"
echo "This will force all workers into maintenance mode (sleep)."
echo "Use this if you need to retry authentication."
echo ""
read -p "Press Enter to RESET workers..." dummy

echo -e "${YELLOW}Reseting workers...${NC}"

# Force recreation with setup override
docker compose -f docker-compose.yml -f docker-compose.setup.yml up -d --force-recreate worker-1 worker-2 worker-3 worker-4 portal

echo ""
echo -e "${BLUE}Workers are now in sleep mode.${NC}"
echo "You can now run 'docker exec -it ai-swarm-worker-N bash' manually,"
echo "or run ./setup.sh again to be guided through the process."
