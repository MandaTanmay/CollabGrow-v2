// Recommendation Model Monitoring & Admin Dashboard
// Include this in your admin panel or separate monitoring app

const axios = require('axios');

const RECOMMEND_API = process.env.RECOMMEND_API || 'http://localhost:5000';

class RecommendationMonitor {
  /**
   * Get current model status
   */
  static async getStatus() {
    try {
      const response = await axios.get(`${RECOMMEND_API}/api/recommend/status`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recommendation status:', error.message);
      return {
        success: false,
        error: error.message,
        model: null
      };
    }
  }

  /**
   * Get training history
   */
  static async getHistory() {
    try {
      const response = await axios.get(`${RECOMMEND_API}/api/recommend/training-history`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching training history:', error.message);
      return { success: false, error: error.message, history: [] };
    }
  }

  /**
   * Check if models are healthy
   */
  static async isHealthy() {
    const status = await this.getStatus();
    
    if (!status.success || !status.model) {
      return false;
    }

    const lastTrained = status.model.lastTrained ? 
      new Date(status.model.lastTrained) : null;
    
    if (!lastTrained) {
      return false;  // No models trained yet
    }

    const hoursOld = (Date.now() - lastTrained.getTime()) / (1000 * 60 * 60);
    return hoursOld < 48;  // Models should be < 48 hours old
  }

  /**
   * Manually trigger retraining
   */
  static async triggerRetrain() {
    try {
      const response = await axios.post(`${RECOMMEND_API}/api/recommend/retrain`, {}, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error triggering retraining:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get formatted status report
   */
  static async getReport() {
    const status = await this.getStatus();
    const healthy = await this.isHealthy();

    const report = {
      timestamp: new Date().toISOString(),
      healthy,
      status: status.model || {},
      retrainingState: status.retraining || {},
      recommendations: []
    };

    // Generate recommendations
    if (!healthy) {
      report.recommendations.push({
        level: 'warning',
        message: 'Models are outdated. Consider manual retraining.'
      });
    }

    if (status.retraining?.error) {
      report.recommendations.push({
        level: 'error',
        message: `Last retraining failed: ${status.retraining.error}`
      });
    }

    const history = await this.getHistory();
    if (history.success && history.history.length > 0) {
      const metrics = history.history[history.history.length - 1].metrics;
      if (metrics.precision < 0.3) {
        report.recommendations.push({
          level: 'warning',
          message: 'Model precision is low. Review training data quality.'
        });
      }
    }

    return report;
  }
}

module.exports = RecommendationMonitor;

// CLI Usage
if (require.main === module) {
  (async () => {
    const command = process.argv[2];

    switch (command) {
      case 'status':
        const status = await RecommendationMonitor.getStatus();
        console.log(JSON.stringify(status, null, 2));
        break;

      case 'health':
        const healthy = await RecommendationMonitor.isHealthy();
        console.log(healthy ? '✅ Models are healthy' : '⚠️ Models need retraining');
        break;

      case 'history':
        const history = await RecommendationMonitor.getHistory();
        console.log(JSON.stringify(history, null, 2));
        break;

      case 'retrain':
        console.log('Triggering retraining...');
        const result = await RecommendationMonitor.triggerRetrain();
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'report':
        const report = await RecommendationMonitor.getReport();
        console.log(JSON.stringify(report, null, 2));
        break;

      default:
        console.log(`
Usage: 
  node recommendation-monitor.js <command>

Commands:
  status      - Get current model status
  health      - Check if models are healthy
  history     - Get training history
  retrain     - Manually trigger retraining
  report      - Get detailed status report
        `);
    }
  })();
}
