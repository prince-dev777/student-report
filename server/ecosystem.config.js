// ESM syntax to match server's "type": "module" in package.json
export default {
  apps: [
    {
      name: 'edutrack-saas',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
