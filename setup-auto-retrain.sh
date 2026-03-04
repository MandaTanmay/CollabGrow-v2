#!/bin/bash
# Auto-Retraining System Setup Script
# Installs and configures the auto-retraining system for production

set -e

echo "======================================================"
echo "CollabGrow Auto-Retraining System Setup"
echo "======================================================"
echo ""

# Check if running from correct directory
if [ ! -f "ecosystem.config.js" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

echo "Step 1: Checking dependencies..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js first."
  exit 1
fi
echo "✓ Node.js $(node --version)"

# Check Python
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
  echo "❌ Python not found. Please install Python 3.8+ first."
  exit 1
fi
PYTHON_CMD=$(command -v python3 || command -v python)
echo "✓ Python $($PYTHON_CMD --version)"

echo ""
echo "Step 2: Installing Node.js dependencies..."
npm install
echo "✓ Node.js dependencies installed"

echo ""
echo "Step 3: Installing Python dependencies..."
$PYTHON_CMD -m pip install -q schedule psycopg2-binary scikit-learn pandas numpy
echo "✓ Python dependencies installed"

echo ""
echo "Step 4: Installing PM2 globally..."
npm install -g pm2
echo "✓ PM2 installed"

echo ""
echo "Step 5: Setting up project interactions..."
cd backend
node scripts/setup-interactions-table.js
cd ..
echo "✓ Project interactions table ready"

echo ""
echo "Step 6: Testing Python auto-retrain script..."
$PYTHON_CMD recommendation/auto_retrain.py
echo "✓ Auto-retrain script works"

echo ""
echo "======================================================"
echo "✅ Setup Complete!"
echo "======================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the system with PM2:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "2. Check status:"
echo "   pm2 status"
echo ""
echo "3. View logs:"
echo "   pm2 logs recommendation-scheduler"
echo ""
echo "4. Monitor models:"
echo "   node backend/scripts/recommendation-monitor.js status"
echo ""
echo "5. Manually trigger retraining:"
echo "   node backend/scripts/recommendation-monitor.js retrain"
echo ""
echo "For detailed guide, see: PRODUCTION_RETRAINING_GUIDE.md"
echo ""
