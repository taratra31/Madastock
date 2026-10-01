/**
 * `prisma migrate deploy` avec reprises.
 *
 * Neon (pooler) met parfois 10 s à sortir du cold start et le verrou
 * consultatif `pg_advisory_lock` expire avant (erreur P1002), ce qui fait
 * échouer le deploy entier alors qu'aucune migration n'est à appliquer.
 *
 * Usage (Render build command) :
 *   node scripts/migrate-deploy.mjs
 */
import { spawn } from 'node:child_process';

const ATTEMPTS = 4;
const BASE_DELAY_MS = 4000;
const MAX_DELAY_MS = 30_000;

const RETRYABLE = ['P1002', 'advisory lock', 'Timed out trying to acquire', 'Can\'t reach database server', 'ECONNRESET', 'ETIMEDOUT'];

function runOnce() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let output = '';
    const capture = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        process.stdout.write(output);
        resolve();
        return;
      }
      const error = new Error(`prisma migrate deploy a échoué (code ${code})`);
      error.output = output;
      reject(error);
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (output = '') => RETRYABLE.some((needle) => output.includes(needle));

let lastOutput = '';
for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  try {
    await runOnce();
    if (attempt > 1) console.log(`[migrate] réussi à la tentative ${attempt}`);
    process.exit(0);
  } catch (error) {
    lastOutput = error.output ?? '';
    process.stdout.write(lastOutput);

    if (attempt === ATTEMPTS || !isRetryable(lastOutput)) {
      console.error(`[migrate] échec définitif après ${attempt} tentative(s)`);
      process.exit(1);
    }

    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
    console.warn(`[migrate] tentative ${attempt}/${ATTEMPTS} échouée (base Neon), nouvelle tentative dans ${Math.round(delay / 1000)} s`);
    await sleep(delay);
  }
}
