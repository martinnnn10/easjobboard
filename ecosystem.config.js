module.exports = {
  apps: [{
    name: "eas-recruit",
    script: "start.js",
    cwd: "/home/ubuntu/eas-recruit",
    env: {
      NODE_ENV: "production",
      PORT: "3030",
      HOSTNAME: "0.0.0.0",
    },
    autorestart: true,
    max_restarts: 10,
    restart_delay: 1000,
  }],
};
