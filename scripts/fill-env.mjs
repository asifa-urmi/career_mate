#!/usr/bin/env node
/**
 * Fills the two secrets `.env` is missing, without them passing through anybody
 * else's hands.
 *
 * Everything else in `.env` — the pooler host, the project ref, the query
 * parameters, the publishable key — is already there and is not secret. What is
 * missing is the database password and the secret key, and those are typed here
 * rather than pasted into a chat window, an issue, or a commit.
 *
 * Nothing is printed back and nothing is stored anywhere but `.env`, which is
 * gitignored.
 *
 *   node scripts/fill-env.mjs
 */

import { createInterface } from 'node:readline'
import { readFileSync, writeFileSync } from 'node:fs'

const ENV = new URL('../.env', import.meta.url)

/** Reads one line without echoing it, so a shoulder or a screen share sees nothing. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })

    // readline echoes by default; muting the output stream is what hides it.
    const onData = () => rl.output.write('')
    rl.output.write(question)
    rl.input.on('data', onData)

    const wasMuted = rl.output.muted
    rl.output.muted = true
    const write = rl.output.write.bind(rl.output)
    rl.output.write = (chunk, ...rest) => (rl.output.muted ? true : write(chunk, ...rest))

    rl.question('', (answer) => {
      rl.output.muted = wasMuted
      rl.output.write = write
      rl.input.off('data', onData)
      rl.close()
      process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

const password = await askHidden('  Supabase database password: ')
if (!password) fail('Nothing entered. Run it again.')

const secret = await askHidden('  Supabase secret key (sb_secret_...): ')
if (!secret) fail('Nothing entered. Run it again.')

if (secret.startsWith('sb_publishable_')) {
  fail(
    'That is the publishable key, which is already set. The secret key starts with sb_secret_ ' +
      'and is under Settings -> API Keys.',
  )
}

// A password with these in it breaks a connection string unless it is encoded.
const encoded = encodeURIComponent(password)

let env = readFileSync(ENV, 'utf8')

if (!env.includes('PASSWORD@') && !env.includes('SUPABASE_SERVICE_ROLE_KEY=""')) {
  fail('.env already looks filled in. Edit it by hand if you want to change something.')
}

env = env.replaceAll(':PASSWORD@', `:${encoded}@`)
env = env.replace('SUPABASE_SERVICE_ROLE_KEY=""', `SUPABASE_SERVICE_ROLE_KEY="${secret}"`)

writeFileSync(ENV, env)

console.log('\n  .env filled. Nothing was printed, and nothing left this machine.')
console.log('  Next:  npm run db:deploy && npm run db:seed\n')
