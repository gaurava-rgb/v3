module.exports = {
    apps: [
        {
            name: 'aggie-v3-bot',
            script: 'bot.js',
            restart_delay: 5000,
            max_restarts: 10,
            autorestart: true,
            watch: false,
            env: { NODE_ENV: 'production', TZ: 'America/Chicago' },
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        },
        {
            name: 'aggie-v3-dash',
            script: 'dashboard.js',
            restart_delay: 3000,
            max_restarts: 10,
            autorestart: true,
            watch: false,
            env: { NODE_ENV: 'production', TZ: 'America/Chicago' },
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        },
        {
            name: 'aggie-v3-monitor',
            script: 'monitor.js',
            restart_delay: 3000,
            max_restarts: 10,
            autorestart: true,
            watch: false,
            env: { NODE_ENV: 'production', TZ: 'America/Chicago' },
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        },
        {
            name: 'aggie-digest',
            script: 'digest.js',
            restart_delay: 10000,
            max_restarts: 10,
            autorestart: true,
            watch: false,
            env: { NODE_ENV: 'production', TZ: 'America/Chicago' },
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        }
    ]
};
