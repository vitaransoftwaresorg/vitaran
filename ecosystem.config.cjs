/**
 * PM2 ecosystem for Vitaran Learning only.
 * Deploy with: pm2 startOrReload /srv/apps/vitaranlearning/ecosystem.config.cjs --only vitaranlearning-api
 *              pm2 startOrReload /srv/apps/vitaranlearning/ecosystem.config.cjs --only vitaranlearning-web
 * Never use `pm2 restart all` for app deploys.
 */
module.exports = {
  apps: [
    {
      name: "vitaranlearning-api",
      cwd: "/srv/apps/vitaranlearning/backend",
      script: "dist/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "512M",
      time: true,
      error_file: "/home/icape/.pm2/logs/vitaranlearning-api-error.log",
      out_file: "/home/icape/.pm2/logs/vitaranlearning-api-out.log",
      merge_logs: true,
    },
    {
      name: "vitaranlearning-web",
      cwd: "/srv/apps/vitaranlearning/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3001",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      max_memory_restart: "512M",
      time: true,
      error_file: "/home/icape/.pm2/logs/vitaranlearning-web-error.log",
      out_file: "/home/icape/.pm2/logs/vitaranlearning-web-out.log",
      merge_logs: true,
    },
  ],
};
