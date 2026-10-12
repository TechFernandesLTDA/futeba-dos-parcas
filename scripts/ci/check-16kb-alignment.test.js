'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { abiOf, checkElf, checkZip, readZipEntries } = require('./check-16kb-alignment');

const SCRIPT = path.join(__dirname, 'check-16kb-alignment.js');

/** ELF64 little-endian mínimo com N segmentos PT_LOAD. */
function elf64(aligns, { offset = 0, vaddr = 0 } = {}) {
  const phnum = aligns.length;
  const buf = Buffer.alloc(64 + 56 * phnum);
  buf.writeUInt32BE(0x7f454c46, 0);
  buf[4] = 2; // 64-bit
  buf[5] = 1; // little-endian
  buf.writeBigUInt64LE(64n, 0x20); // e_phoff
  buf.writeUInt16LE(56, 0x36); // e_phentsize
  buf.writeUInt16LE(phnum, 0x38); // e_phnum
  aligns.forEach((align, i) => {
    const o = 64 + 56 * i;
    buf.writeUInt32LE(1, o); // PT_LOAD
    buf.writeBigUInt64LE(BigInt(offset), o + 8);
    buf.writeBigUInt64LE(BigInt(vaddr), o + 16);
    buf.writeBigUInt64LE(BigInt(align), o + 48);
  });
  return buf;
}

/** ELF32 little-endian mínimo (para garantir o parse de 32 bits). */
function elf32(align) {
  const buf = Buffer.alloc(52 + 32);
  buf.writeUInt32BE(0x7f454c46, 0);
  buf[4] = 1;
  buf[5] = 1;
  buf.writeUInt32LE(52, 0x1c);
  buf.writeUInt16LE(32, 0x2a);
  buf.writeUInt16LE(1, 0x2c);
  buf.writeUInt32LE(1, 52);
  buf.writeUInt32LE(align, 52 + 28);
  return buf;
}

/** Monta um ZIP; entries = [{name, data, store, padTo}] (padTo alinha o início dos dados via extra). */
function makeZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const store = e.store !== false;
    const body = store ? e.data : zlib.deflateRawSync(e.data);
    let extra = Buffer.alloc(0);
    if (e.padTo) {
      const base = offset + 30 + name.length;
      extra = Buffer.alloc((e.padTo - (base % e.padTo)) % e.padTo);
    }
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(store ? 0 : 8, 8);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(e.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(extra.length, 28);
    locals.push(header, name, extra, body);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(store ? 0 : 8, 10);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += header.length + name.length + extra.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

function tmpFile(name, data) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'check16kb-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, data);
  return file;
}

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

test('abiOf reconhece APK e AAB e ignora o resto', () => {
  assert.equal(abiOf('lib/arm64-v8a/libx.so'), 'arm64-v8a');
  assert.equal(abiOf('base/lib/x86_64/libx.so'), 'x86_64');
  assert.equal(abiOf('base/dex/classes.dex'), null);
  assert.equal(abiOf('assets/lib/foo.txt'), null);
});

test('checkElf aprova p_align 0x4000 (ELF64 e ELF32)', () => {
  assert.equal(checkElf(elf64([0x4000, 0x4000, 0x10000])).ok, true);
  assert.equal(checkElf(elf32(0x4000)).ok, true);
});

test('checkElf reprova p_align 0x1000 e arquivo que não é ELF', () => {
  const bad = checkElf(elf64([0x4000, 0x1000]));
  assert.equal(bad.ok, false);
  assert.match(bad.reasons[0], /p_align=0x1000/);
  assert.equal(checkElf(elf32(0x1000)).ok, false);
  assert.equal(checkElf(Buffer.from('not an elf at all'.repeat(10))).ok, false);
});

test('checkElf reprova p_offset/p_vaddr desalinhados', () => {
  assert.equal(checkElf(elf64([0x4000], { offset: 0x1000, vaddr: 0 })).ok, false);
});

test('checkZip: AAB com .so comprimida e alinhada passa; ABIs 32-bit são ignoradas', () => {
  const file = tmpFile('app.aab', makeZip([
    { name: 'base/lib/arm64-v8a/liba.so', data: elf64([0x4000]), store: false },
    { name: 'base/lib/x86_64/liba.so', data: elf64([0x4000]), store: false },
    { name: 'base/lib/armeabi-v7a/liba.so', data: elf32(0x1000), store: false },
  ]));
  const results = checkZip(file);
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.ok));
});

test('checkZip: .so 4 KB em arm64-v8a ou x86_64 reprova', () => {
  const file = tmpFile('app.aab', makeZip([
    { name: 'base/lib/arm64-v8a/liba.so', data: elf64([0x4000]), store: false },
    { name: 'base/lib/x86_64/libdatastore_shared_counter.so', data: elf64([0x1000]), store: false },
  ]));
  const results = checkZip(file);
  assert.deepEqual(results.map((r) => r.ok), [true, false]);
});

test('checkZip: APK com .so sem compressão exige offset múltiplo de 16 KB', () => {
  const aligned = tmpFile('ok.apk', makeZip([
    { name: 'lib/arm64-v8a/liba.so', data: elf64([0x4000]), padTo: 16384 },
  ]));
  assert.ok(checkZip(aligned)[0].ok);
  const misaligned = tmpFile('bad.apk', makeZip([
    { name: 'lib/arm64-v8a/liba.so', data: elf64([0x4000]), padTo: 4096 },
  ]));
  const [r] = checkZip(misaligned);
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /16384/);
});

test('readZipEntries lê nomes e métodos', () => {
  const buf = makeZip([{ name: 'a.txt', data: Buffer.from('x'), store: true }, { name: 'b.txt', data: Buffer.from('y'.repeat(100)), store: false }]);
  assert.deepEqual(readZipEntries(buf).map((e) => [e.name, e.method]), [['a.txt', 0], ['b.txt', 8]]);
});

test('CLI: exit 0 quando alinhado, 1 quando não, 1 quando nada é encontrado', () => {
  const ok = tmpFile('ok.aab', makeZip([
    { name: 'base/lib/arm64-v8a/liba.so', data: elf64([0x4000]) },
    { name: 'base/lib/x86_64/liba.so', data: elf64([0x4000]) },
  ]));
  assert.equal(run(ok).status, 0);

  const bad = tmpFile('bad.aab', makeZip([
    { name: 'base/lib/arm64-v8a/liba.so', data: elf64([0x1000]) },
    { name: 'base/lib/x86_64/liba.so', data: elf64([0x4000]) },
  ]));
  const failed = run(bad);
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /FAIL\s+arm64-v8a/);

  const empty = tmpFile('empty.aab', makeZip([{ name: 'base/dex/classes.dex', data: Buffer.from('dex') }]));
  assert.equal(run(empty).status, 1);
  assert.equal(run('--allow-empty', empty).status, 0);
  assert.equal(run().status, 2);
});
