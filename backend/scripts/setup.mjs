import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

if (!existsSync('.env')) {
  const example = readFileSync('.env.example', 'utf8');
  writeFileSync('.env', example.replace('replace-with-at-least-32-random-characters', randomBytes(48).toString('hex')), { mode: 0o600 });
  console.log('Created backend/.env with a random server secret.');
} else console.log('Kept existing backend/.env.');
for (const addresses of Object.values(networkInterfaces())) {
  for (const address of addresses || []) {
    if (address.family === 'IPv4' && !address.internal) console.log(`Phone API URL: http://${address.address}:3001`);
  }
}
