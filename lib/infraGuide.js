/**
 * Non-secret infrastructure reference for the Infrastructure page.
 *
 * This file ships in the public JS bundle, so it holds only what is already
 * in the backend repo (deploy/docker/README.md): names, ports, paths. The VPS
 * address, SSH user and every password live in the encrypted vault instead,
 * and fill the {{PLACEHOLDERS}} below once the vault is unlocked.
 */

/** Vault entries can be tagged with one of these to fill placeholders. */
export const VAULT_REFS = [
  { id: 'VPS_HOST', label: 'VPS host / IP', secret: false },
  { id: 'SSH_USER', label: 'SSH user', secret: false },
  { id: 'SSH_PORT', label: 'SSH port', secret: false },
  { id: 'PROD_DB_PASSWORD', label: 'Production DB password', secret: true },
  { id: 'STAGING_DB_PASSWORD', label: 'Staging DB password', secret: true },
  { id: 'LOCAL_DB_PASSWORD', label: 'Local DB password', secret: true },
]

export const ENVS = [
  { id: 'production', label: 'Production', tone: 'red' },
  { id: 'staging', label: 'Dev / Staging', tone: 'amber' },
  { id: 'local', label: 'Local (Mac)', tone: 'green' },
  { id: 'shared', label: 'Shared / Server', tone: 'muted' },
]

export const ENVIRONMENTS = [
  {
    id: 'production',
    name: 'Production',
    url: 'https://marketneurons.tech',
    warning: 'Live users. Read only from pgAdmin; changes go through migrations and deploys.',
    facts: [
      ['Branch that deploys', 'production'],
      ['Database', 'market_neurons'],
      ['DB role', 'marketapi'],
      ['DB host (on VPS)', '127.0.0.1:5432'],
      ['Backend / frontend ports', '8100 / 3100 (127.0.0.1 only)'],
      ['Stack dir', '/opt/market-neurons'],
      ['Env file', '/etc/market-neurons-backend.env'],
      ['Docker bridge', 'br-mn · 172.30.0.0/24'],
    ],
    passwordRef: 'PROD_DB_PASSWORD',
    dbName: 'market_neurons',
    dbUser: 'marketapi',
    tunnelPort: 5433,
    envFile: '/etc/market-neurons-backend.env',
  },
  {
    id: 'staging',
    name: 'Dev / Staging',
    url: 'https://dev.marketneurons.tech',
    warning: 'A copy of production with real users’ data, shared by the team, replaced on every refresh.',
    facts: [
      ['Branch that deploys', 'dev'],
      ['Database', 'market_neurons_staging'],
      ['DB role', 'marketapi_staging'],
      ['DB host (on VPS)', '127.0.0.1:5432'],
      ['Backend / frontend ports', '8200 / 3200 (127.0.0.1 only)'],
      ['Stack dir', '/opt/market-neurons-staging'],
      ['Env file', '/etc/market-neurons-backend-staging.env'],
      ['Docker bridge', 'br-mn-stg · 172.31.0.0/24'],
      ['Email', 'console only — nobody is mailed'],
    ],
    passwordRef: 'STAGING_DB_PASSWORD',
    dbName: 'market_neurons_staging',
    dbUser: 'marketapi_staging',
    tunnelPort: 5433,
    envFile: '/etc/market-neurons-backend-staging.env',
  },
  {
    id: 'local',
    name: 'Local (your Mac)',
    url: 'http://localhost:3000',
    warning: 'Yours to break. Values come from market_neurons_backend/.env.',
    facts: [
      ['PostgreSQL', 'Homebrew postgresql@17'],
      ['Host / port', 'localhost:5432'],
      ['Database / role', 'POSTGRES_DB / POSTGRES_USER in .env'],
      ['API', 'http://127.0.0.1:8000'],
      ['Frontend', 'http://localhost:3000'],
    ],
    passwordRef: 'LOCAL_DB_PASSWORD',
    dbName: '<POSTGRES_DB>',
    dbUser: '<POSTGRES_USER>',
    tunnelPort: null,
    envFile: 'market_neurons_backend/.env',
  },
]

const SSH = '{{SSH_USER}}@{{VPS_HOST}}'

/** Step lists per environment. `cmd` is copyable; placeholders fill from the vault. */
export function stepsFor(env) {
  if (env.id === 'local') {
    return [
      { title: 'Start PostgreSQL', cmd: 'brew services start postgresql@17\npg_isready' },
      { title: 'Open with psql', cmd: `psql -h localhost -p 5432 -U ${env.dbUser} ${env.dbName}` },
      {
        title: 'pgAdmin',
        text: 'Register → Server. Connection: Host localhost, Port 5432, database and user from .env, Save password on. SSH Tunnel off.',
      },
      {
        title: 'Reset a forgotten local password',
        cmd: 'psql postgres -c "\\password <POSTGRES_USER>"',
        text: 'Then put the same value in POSTGRES_PASSWORD in .env.',
      },
      {
        title: 'Download a copy of the dev database',
        cmd: `ssh -p {{SSH_PORT}} ${SSH} "sudo -u postgres pg_dump -Fc --no-owner --no-privileges market_neurons_staging" > ~/Downloads/mn_dev.dump\npg_restore -l ~/Downloads/mn_dev.dump | head -5`,
        text: 'Read-only on the server. The file holds real users’ data: never commit or share it, delete it when done.',
      },
      {
        title: 'Replace your local database with the dev copy',
        cmd: `pg_dump -Fc ${env.dbName} -f ~/Downloads/mn_local_backup.dump\ndropdb --force ${env.dbName}\ncreatedb ${env.dbName}\npg_restore --no-owner --no-privileges -d ${env.dbName} ~/Downloads/mn_dev.dump\ncd market_neurons_backend && ../venv/bin/python manage.py migrate`,
        text: 'Run from the workspace root. The first line backs up your current local data; dropdb deletes it. migrate applies local migrations newer than dev.',
      },
      {
        title: 'Undo: restore your old local database',
        cmd: `dropdb --force ${env.dbName}\ncreatedb ${env.dbName}\npg_restore --no-owner -d ${env.dbName} ~/Downloads/mn_local_backup.dump`,
      },
    ]
  }
  return [
    {
      title: 'Open the SSH tunnel (keep this window open)',
      cmd: `ssh -N -L ${env.tunnelPort}:127.0.0.1:5432 -p {{SSH_PORT}} ${SSH}`,
      text: 'No output is normal. Port 5433 on your Mac, because local PostgreSQL already uses 5432.',
    },
    {
      title: 'Connect with psql',
      cmd: `psql "postgresql://${env.dbUser}@127.0.0.1:${env.tunnelPort}/${env.dbName}"`,
    },
    {
      title: 'pgAdmin',
      text: `Register → Server. Connection: Host 127.0.0.1, Port ${env.tunnelPort}, Maintenance DB ${env.dbName}, Username ${env.dbUser}, password from the vault. SSH Tunnel tab off.`,
    },
    {
      title: 'Read the password on the server (if the vault is out of date)',
      cmd: `ssh -p {{SSH_PORT}} ${SSH} "grep '^POSTGRES_PASSWORD=' ${env.envFile}"`,
    },
    env.id === 'production'
      ? {
          title: 'Make the pgAdmin session read-only first',
          cmd: 'SET default_transaction_read_only = on;',
          text: 'Run this in the Query Tool before anything else.',
        }
      : {
          title: 'Refresh staging from production',
          cmd: `ssh -p {{SSH_PORT}} ${SSH} "sudo /opt/market-neurons-staging/refresh-db.sh"`,
          text: 'Replaces the whole staging database. Manual edits are lost.',
        },
  ]
}

export const TROUBLESHOOTING = [
  ['port 15432 … Connection refused (pgAdmin)', 'pgAdmin’s own tunnel did not open — usually the key passphrase. Use the Terminal tunnel instead.'],
  ['channel 2: open failed … Connection refused', 'Tunnel target wrong. It must be 127.0.0.1:5432 (PostgreSQL does not listen on the public IP).'],
  ['password authentication failed', 'Tunnel works; password or user wrong. Check the user matches the database.'],
  ['bind 127.0.0.1:5433: Address already in use', 'An old tunnel is open. Close it, or `lsof -i :5433` and kill it.'],
  ['Asked for root’s password on the server', 'You ran `ssh …` while already logged in to the server. Run the command without ssh.'],
]

/** Fills {{REF}} from unlocked vault values; unknown refs stay visible as <REF>. */
export function fillPlaceholders(text, values) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_, ref) => {
    if (ref === 'SSH_PORT') return values.SSH_PORT || '22'
    return values[ref] || `<${ref}>`
  })
}
