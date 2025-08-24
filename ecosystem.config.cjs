module.exports = {
  apps: [
    {
      name: 'snapquote',
      script: 'server.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        SUPABASE_URL: 'https://jrvztbzxvpfkqjdafwkp.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impydnp0Ynp4dnBma3FqZGFmd2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ1MjgxNTcsImV4cCI6MjA0MDEwNDE1N30.CDGqSP7C6jexnvHw4z14DjHrQ5gEHzRAGdVgSCRz8ZY'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}