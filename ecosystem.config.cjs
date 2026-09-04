module.exports = {
  apps: [
    {
      name: "wallet",
      cwd: "/opt/wallet",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0",
        PORT: "8790",
        WALLET_SIM_DB_PATH: "/opt/wallet/data/wallet.db",
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
