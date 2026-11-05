import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { zipDirectory, crc32 } from './zip.js';

test('crc32 connu', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('archive ZIP relisible', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>héllo</h1>');
  fs.writeFileSync(path.join(dir, 'sub', 'a.js'), 'x'.repeat(5000));
  fs.writeFileSync(path.join(dir, 'old.wgt'), 'ignored');
  const out = path.join(dir, 'out.zip');
  assert.deepEqual(zipDirectory(dir, out), ['index.html', 'sub/a.js']);

  // Relit l'archive via le répertoire central.
  const buf = fs.readFileSync(out);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const local = buf.readUInt32LE(p + 42);
    const size = buf.readUInt32LE(p + 20);
    const start = local + 30 + buf.readUInt16LE(local + 26);
    files[name] = zlib.inflateRawSync(buf.subarray(start, start + size)).toString();
    p += 46 + nameLen;
  }
  assert.equal(files['index.html'], '<h1>héllo</h1>');
  assert.equal(files['sub/a.js'].length, 5000);
});
