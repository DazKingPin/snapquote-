// PM2 Configuration for SnapQuote Development
module.exports = {
  apps: [
    {
      name: 'snapquote',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=snapquote-db --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
}