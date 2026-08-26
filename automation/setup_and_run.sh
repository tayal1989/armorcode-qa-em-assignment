#!/bin/bash

# Exit immediately if any command fails
set -e

# Define text coloring variables for beautiful CLI output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}   OpenTelemetry Astronomy Shop Test Suite Setup & Execution    ${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# 1. Verify Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js (v18.x or higher) first.${NC}"
    exit 1
fi

echo -e "${GREEN}[1/4] Node.js version verified: $(node -v)${NC}"

# 2. Install Project Dependencies
echo -e "\n${YELLOW}[2/4] Installing project npm dependencies (playwright, typescript, log4js, ajv)...${NC}"
npm install

# 3. Install Playwright browser binaries
echo -e "\n${YELLOW}[3/4] Installing Playwright browser binaries (Chromium, Firefox, WebKit)...${NC}"
npx playwright install

# 4. Execute the test suite
echo -e "\n${YELLOW}[4/4] Running all automated API & UI test cases...${NC}"
npm run test

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}             Execution Finished Successfully!                   ${NC}"
echo -e "${GREEN}================================================================${NC}\n"
echo -e "Continuous log file generated at: ${BLUE}logs/test_execution.log${NC}"
echo -e "Playwright HTML report compiled at: ${BLUE}reports/index.html${NC}"
echo -e "Executive Visual Analytics Dashboard compiled at: ${BLUE}reports/dashboard.html${NC}"
echo -e "\nTo open the Visual Dashboard in your browser, run:"
echo -e "  ${GREEN}npm run test:dashboard${NC}"
echo -e "To open the Playwright detailed report, run:"
echo -e "  ${GREEN}npm run test:report${NC}\n"
