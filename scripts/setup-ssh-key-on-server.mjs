#!/usr/bin/env node
/**
 * One-time script: copies local SSH public key to server's authorized_keys.
 * Password is passed as first argument only (not stored anywhere).
 * Usage: node scripts/setup-ssh-key-on-server.mjs "YOUR_PASSWORD"
 * After success you can delete this file.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'ssh2';

const SERVER = '178.172.138.162';
const USER = 'root';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node setup-ssh-key-on-server.mjs "YOUR_PASSWORD"');
  process.exit(1);
}

const keyPath = join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519.pub');
let pubKey;
try {
  pubKey = readFileSync(keyPath, 'utf8').trim();
} catch (e) {
  console.error('Could not read', keyPath, e.message);
  process.exit(1);
}

const conn = new Client();
conn
  .on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) {
        console.error('SFTP:', err.message);
        conn.end();
        process.exit(1);
      }
      const done = (msg) => {
        console.log(msg || 'SSH key added. Connect without password: ssh root@' + SERVER);
        conn.end();
      };
      sftp.mkdir('.ssh', 0o700, (mkdirErr) => {
        if (mkdirErr && mkdirErr.code !== 4) {
          console.error('mkdir .ssh:', mkdirErr.message);
          conn.end();
          return;
        }
        sftp.readFile('.ssh/authorized_keys', { encoding: 'utf8' }, (readErr, existing) => {
          let content = '';
          if (!readErr && existing) {
            content = existing.trim();
            if (content && !content.endsWith('\n')) content += '\n';
            if (content.includes(pubKey)) {
              done('Key already on server.');
              return;
            }
          }
          content += pubKey + '\n';
          sftp.writeFile('.ssh/authorized_keys', content, { mode: 0o600 }, (writeErr) => {
            if (writeErr) {
              console.error('Write:', writeErr.message);
              conn.end();
              process.exit(1);
            }
            done();
          });
        });
      });
    });
  })
  .on('error', (err) => {
    console.error('SSH error:', err.message);
    process.exit(1);
  })
  .connect({
    host: SERVER,
    port: 22,
    username: USER,
    password,
  });
