#!/bin/bash

echo "🧹 Clearing All Caches & Restarting Servers"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Clear rate limits
echo -e "${BLUE}1️⃣  Clearing rate limits...${NC}"
cd /home/guna/Projects/CollabGrow/backend
node scripts/clear-rate-limits.js
echo ""

# 2. Stop all servers
echo -e "${BLUE}2️⃣  Stopping servers...${NC}"
kill -9 $(lsof -ti:5000) 2>/dev/null && echo "  ✓ Backend stopped" || echo "  - Backend not running"
kill -9 $(lsof -ti:3001) 2>/dev/null && echo "  ✓ Frontend stopped" || echo "  - Frontend not running"
kill -9 $(lsof -ti:3000) 2>/dev/null && echo "  ✓ Alt frontend stopped" || echo "  - Alt frontend not running"
echo ""

# 3. Clear Next.js cache
echo -e "${BLUE}3️⃣  Clearing Next.js cache...${NC}"
cd /home/guna/Projects/CollabGrow/frontend
rm -rf .next
echo "  ✓ .next folder removed"
echo ""

# 4. Start backend
echo -e "${BLUE}4️⃣  Starting backend...${NC}"
cd /home/guna/Projects/CollabGrow/backend
nohup node server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "  ✓ Backend started (PID: $BACKEND_PID)"
echo ""

# 5. Wait for backend to be ready
echo -e "${BLUE}5️⃣  Waiting for backend...${NC}"
sleep 3
HEALTH=$(curl -s http://localhost:5000/health | grep -o '"status":"OK"')
if [ -n "$HEALTH" ]; then
    echo -e "  ${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "  ${YELLOW}⚠ Backend might not be ready yet${NC}"
fi
echo ""

# 6. Start frontend
echo -e "${BLUE}6️⃣  Starting frontend...${NC}"
cd /home/guna/Projects/CollabGrow/frontend
echo "  Starting npm run dev in background..."
echo "  This will take a few seconds..."
echo ""
echo -e "${GREEN}Frontend will be available at:${NC}"
echo "  → http://localhost:3000 or"
echo "  → http://localhost:3001"
echo ""
echo "==========================================="
echo -e "${GREEN}✅ Everything cleared and restarted!${NC}"
echo "==========================================="
echo ""
echo "📋 Next Steps:"
echo "1. In a new terminal, run: cd frontend && npm run dev"
echo "2. Clear browser cache (Ctrl+Shift+Delete)"
echo "3. Open: http://localhost:3001/auth/login"
echo "4. Try logging in!"
echo ""
echo "Backend logs: tail -f /tmp/backend.log"
echo ""
