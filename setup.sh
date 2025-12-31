#!/usr/bin/env bash
#
# AI Swarm v2 - Seamless Setup Wizard
# Orchestrates: Deployment -> Maintenance Mode -> Auth Help -> Production Mode
#

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

WORKERS=("ai-swarm-worker-1" "ai-swarm-worker-2" "ai-swarm-worker-3" "ai-swarm-worker-4" "ai-swarm-portal")

print_header() {
    clear
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}              ${BOLD}AI Swarm v2 - Setup Wizard${NC}                       ${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "This script will guide you through:"
    echo "  1. Configuring Google OAuth (Verified Redirect URI)"
    echo "  2. Starting the system in 'Setup Mode' (prevents crashes)"
    echo "  3. Authenticating the Gemini CLI for each worker + portal"
    echo "  4. Launching the full production system"
    echo ""
}

step_0_config_check() {
    echo -e "${BLUE}[1/4] Checking Configuration...${NC}"

    # Check if .env exists
    if [ ! -f .env ]; then
        echo -e "${RED}Error: .env file missing!${NC}"
        echo "Please copy .env.example to .env and configure it first."
        exit 1
    fi

    # Load environment variables to construct the callback URL
    set -a
    source .env
    set +a

    # Determine the callback URL
    # If NEXTAUTH_URL is set, use it. Otherwise default to localhost.
    BASE_URL="${NEXTAUTH_URL:-http://localhost:3000}"
    CALLBACK_URL="${BASE_URL}/api/auth/callback/google"

    echo ""
    echo -e "${YELLOW}IMPORTANT: Google OAuth Configuration${NC}"
    echo "To avoid 'Error 400: redirect_uri_mismatch', you must whitelist this URL:"
    echo ""
    echo -e "  Redirect URI:  ${BOLD}${GREEN}${CALLBACK_URL}${NC}"
    echo ""
    echo "ACTION REQUIRED:"
    echo "1. Go to https://console.cloud.google.com/apis/credentials"
    echo "2. Edit your OAuth 2.0 Client ID."
    echo "3. Add the URL above to 'Authorized redirect URIs'."
    echo "4. Click Save."
    echo ""
    
    read -p "Press Enter once you have configured the Redirect URI..." dummy
    echo ""
}

step_1_maintenance() {
    echo -e "${BLUE}[2/4] Starting Swarm in Setup Mode...${NC}"
    
    echo "      Launching maintenance containers..."
    # Launch with both base config AND setup override (sleep infinity)
    docker compose -f docker-compose.yml -f docker-compose.setup.yml up -d --remove-orphans
    
    echo -e "${GREEN}      ✓ Maintenance containers running.${NC}"
    echo ""
}

step_2_auth() {
    echo -e "${BLUE}[3/4] Authenticating Workers...${NC}"
    echo ""
    echo "      We need to authenticate ${#WORKERS[@]} workers."
    echo "      For each worker, you will need to open a separate terminal."
    echo ""

    local count=1
    for worker in "${WORKERS[@]}"; do
        echo -e "${YELLOW}═════════════════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}▶ Worker ${count} of 4: ${BLUE}${worker}${NC}"
        echo -e "${YELLOW}═════════════════════════════════════════════════════════════════${NC}"
        echo ""
        echo -e "  ${BOLD}[ACTION REQUIRED]${NC}"
        echo "  1. Open a NEW terminal window (local or remote)."
        echo "  2. Run this command exactly:"
        echo ""
        echo -e "     ${GREEN}docker exec -it ${worker} bash${NC}"
        echo ""
        echo "  3. Inside the container, run:"
        echo ""
        echo -e "     ${GREEN}gemini auth login${NC}"
        echo ""
        echo "  4. Follow the link, sign in, and wait for success message."
        echo "  5. Type 'exit' to leave the container."
        echo ""
        
        while true; do
            echo -e "  Type ${BOLD}AUTHENTICATED${NC} to confirm you are done with this worker:"
            read -p "  > " confirmation
            if [ "$confirmation" == "AUTHENTICATED" ]; then
                echo -e "  ${GREEN}✓ Confirmed.${NC}"
                break
            else
                echo -e "  ${RED}Please type exactly 'AUTHENTICATED' (all caps).${NC}"
            fi
        done
        echo ""
        count=$((count + 1))
    done
}

step_3_production() {
    echo -e "${BLUE}[4/4] Launching Production Swarm...${NC}"
    
    echo "      Restarting workers in production mode..."
    
    # Run standard docker compose up (reverts to original command)
    docker compose up -d --remove-orphans
    
    echo -e "${GREEN}      ✓ Workers restarted.${NC}"
    echo ""

    echo "      Ensuring Temporal namespace exists..."
    # Register namespace to avoid "Namespace not found" error
    # We use 'temporal:7233' because 'localhost' often fails inside the container depending on binding
    docker exec temporal tctl --address temporal:7233 --namespace ai-swarm namespace register || echo "Namespace already registered."
    echo ""
}

print_success() {
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}               ${GREEN}Setup Complete!${NC}                                 ${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Your AI Swarm is now running."
    echo "  - Portal:    ${NEXTAUTH_URL:-http://localhost:3000}"
    echo "  - Temporal:  http://localhost:8233 (if tunneled)"
    echo ""
    echo "  To stop the swarm: docker compose stop"
    echo "  To restart:        docker compose up -d"
    echo ""
}

# Main execution
print_header
read -p "Press Enter to begin..." dummy
echo ""

step_0_config_check
step_1_maintenance
step_2_auth
step_3_production
print_success
