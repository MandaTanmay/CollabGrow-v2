module.exports = {
  "apps": [
    {
      "name": "collabgrow-backend",
      "script": "./server.js",
      "cwd": "./backend",
      "instances": "max",
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "production"
      },
      "error_file": "logs/backend-error.log",
      "out_file": "logs/backend-out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "max_memory_restart": "500M"
    },
    {
      "name": "recommendation-scheduler",
      "script": "./recommendation/auto_retrain.py",
      "interpreter": "python",
      "args": "run",
      "cwd": ".",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "PYTHONUNBUFFERED": "1"
      },
      "error_file": "logs/scheduler-error.log",
      "out_file": "logs/scheduler-out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "max_memory_restart": "1G",
      "autorestart": true,
      "watch": false,
      "ignore_watch": [
        "recommendation/models",
        "recommendation/__pycache__",
        "node_modules"
      ]
    }
  ],
  "deploy": {
    "production": {
      "user": "node",
      "host": "your-server.com",
      "ref": "origin/main",
      "repo": "git@github.com:your-repo/collabgrow.git",
      "path": "/var/www/collabgrow",
      "post-deploy": "npm install && pip install -r recommendation/requirements.txt && pm2 start ecosystem.config.js --env production"
    }
  }
};
