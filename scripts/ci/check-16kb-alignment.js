#!/usr/bin/env node
'use strict';

/**
 * Guarda de 16 KB page size para o Google Play.
 *
 * Verifica, em um AAB/APK de release (ou num diretório/arquivo .so), se TODAS as
 * bibliotecas nativas das ABIs 64-bit (arm64-v8a e x86_64) estão prontas para
 * dispositivos com páginas de 16 KB:
 *
 *   1. ELF: todo segmento PT_LOAD precisa ter p_align >= 16384 e
 *      (p_offset % p_align) == (p_vaddr % p_align).
 *   2. ZIP (somente APK): .so armazenado sem compressão precisa começar em um
 *      offset múltiplo de 16384 (equivalente a `zipalign -c -P 16 -v 4`).
 *
 * Sem dependências: lê o ZIP direto (Node + zlib), então roda em qualquer runner
 * (não exige unzip, readelf, NDK nem build-tools).
 *
 * Uso: node scripts/ci/check-16kb-alignment.js <arquivo.aab|arquivo.apk|dir|lib.so>...
 *   --allow-empty   não falha quando nenhuma .so 64-bit é encontrada
 * Saída: exit 0 se tudo alinhado; exit 1 se alguma .so falhar ou se nada for
 * encontrado (evita aprovar por engano um caminho errado).
 *
 * Referência: https://developer.android.com/guide/practices/page-sizes
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const PAGE_SIZE = 16384;
const CHECKED_ABIS = ['arm64-v8a', 'x86_64'];
const PT_LOAD = 1;

/** Devolve a ABI de um caminho tipo `lib/arm64-v8a/x.so` ou `base/lib/x86_64/x.so`. */
function abiOf(entryName) {
  const m = /(?:^|\/)lib\/([^/]+)\/[^/]+\.so$/.exec(entryName.replace(/\\/g, '/'));
  return m ? m[1] : null;
}

/**
 * Analisa os segmentos PT_LOAD de um ELF.
 * @param {Buffer} buf
 * @returns {{ok: boolean, reasons: string[], aligns: number[]}}
 */
function checkElf(buf) {
  const reasons = [];
  if (buf.length < 64 || buf.readUInt32BE(0) !== 0x7f454c46) {
    return { ok: false, reasons: ['não é um arquivo ELF'], aligns: [] };
  }
  const is64 = buf[4] === 2;
  const little = buf[5] === 1;
  const u16 = (o) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const u64 = (o) => Number(little ? buf.readBigUInt64LE(o) : buf.readBigUInt64BE(o));

  const phoff = is64 ? u64(0x20) : u32(0x1c);
  const phentsize = is64 ? u16(0x36) : u16(0x2a);
  const phnum = is64 ? u16(0x38) : u16(0x2c);
  const aligns = [];
  for (let i = 0; i < phnum; i += 1) {
    const o = phoff + i * phentsize;
    if (o + phentsize > buf.length) {
      reasons.push('tabela de program headers truncada');
      break;
    }
    const type = u32(o);
    if (type !== PT_LOAD) continue;
    const offset = is64 ? u64(o + 8) : u32(o + 4);
    const vaddr = is64 ? u64(o + 16) : u32(o + 8);
    const align = is64 ? u64(o + 48) : u32(o + 28);
    aligns.push(align);
    if (align < PAGE_SIZE) {
      reasons.push(`PT_LOAD #${aligns.length} com p_align=0x${align.toString(16)} (< 0x4000)`);
    } else if (offset % align !== vaddr % align) {
      reasons.push(`PT_LOAD #${aligns.length} com p_offset/p_vaddr desalinhados (mod 0x${align.toString(16)})`);
    }
  }
  if (aligns.length === 0) reasons.push('nenhum segmento PT_LOAD');
  return { ok: reasons.length === 0, reasons, aligns };
}

/**
 * Lê as entradas do diretório central de um ZIP.
 * @param {Buffer} buf
 * @returns {{name: string, method: number, compSize: number, localOffset: number}[]}
 */
function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP inválido: EOCD não encontrado');
  let total = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdOffset === 0xffffffff) {
    // ZIP64
    const loc = eocd - 20;
    if (loc < 0 || buf.readUInt32LE(loc) !== 0x07064b50) throw new Error('ZIP64 inválido');
    const z64 = Number(buf.readBigUInt64LE(loc + 8));
    total = Number(buf.readBigUInt64LE(z64 + 32));
    cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
  }
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < total; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP inválido: diretório central corrompido');
    const method = buf.readUInt16LE(p + 10);
    let compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (compSize === 0xffffffff || localOffset === 0xffffffff) {
      // campos ZIP64 no extra
      let e = p + 46 + nameLen;
      const end = e + extraLen;
      while (e + 4 <= end) {
        const id = buf.readUInt16LE(e);
        const size = buf.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let q = e + 4;
          if (buf.readUInt32LE(p + 24) === 0xffffffff) q += 8; // uncompressed
          if (compSize === 0xffffffff) {
            compSize = Number(buf.readBigUInt64LE(q));
            q += 8;
          }
          if (localOffset === 0xffffffff) localOffset = Number(buf.readBigUInt64LE(q));
        }
        e += 4 + size;
      }
    }
    entries.push({ name, method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Extrai os bytes de uma entrada e informa onde seus dados começam no arquivo. */
function readZipEntry(buf, entry) {
  const o = entry.localOffset;
  if (buf.readUInt32LE(o) !== 0x04034b50) throw new Error(`cabeçalho local inválido em ${entry.name}`);
  const nameLen = buf.readUInt16LE(o + 26);
  const extraLen = buf.readUInt16LE(o + 28);
  const dataOffset = o + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataOffset, dataOffset + entry.compSize);
  if (entry.method === 0) return { data: raw, dataOffset };
  if (entry.method === 8) return { data: zlib.inflateRawSync(raw), dataOffset };
  throw new Error(`método de compressão ${entry.method} não suportado em ${entry.name}`);
}

/**
 * Verifica um ZIP (AAB ou APK).
 * @returns {{file: string, abi: string, ok: boolean, reasons: string[]}[]}
 */
function checkZip(file) {
  const buf = fs.readFileSync(file);
  const isApk = file.toLowerCase().endsWith('.apk');
  const results = [];
  for (const entry of readZipEntries(buf)) {
    const abi = abiOf(entry.name);
    if (!abi || !CHECKED_ABIS.includes(abi)) continue;
    const { data, dataOffset } = readZipEntry(buf, entry);
    const elf = checkElf(data);
    const reasons = [...elf.reasons];
    if (isApk && entry.method === 0 && dataOffset % PAGE_SIZE !== 0) {
      reasons.push(`.so sem compressão em offset ${dataOffset} (não múltiplo de 16384; rode zipalign -P 16)`);
    }
    results.push({ file: `${path.basename(file)}!${entry.name}`, abi, ok: reasons.length === 0, reasons, aligns: elf.aligns });
  }
  return results;
}

/** Verifica um .so solto (a ABI vem do nome do diretório pai). */
function checkSoFile(file) {
  const abi = abiOf(file) || path.basename(path.dirname(file));
  if (!CHECKED_ABIS.includes(abi)) return [];
  const elf = checkElf(fs.readFileSync(file));
  return [{ file, abi, ok: elf.ok, reasons: elf.reasons, aligns: elf.aligns }];
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Verifica um alvo (arquivo ou diretório) e devolve os resultados por .so. */
function checkTarget(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    return walk(target).flatMap((f) => {
      if (/\.(aab|apk)$/i.test(f)) return checkZip(f);
      if (f.endsWith('.so')) return checkSoFile(f);
      return [];
    });
  }
  if (/\.(aab|apk|zip|aar)$/i.test(target)) return checkZip(target);
  if (target.endsWith('.so')) return checkSoFile(target);
  throw new Error(`tipo de alvo não suportado: ${target}`);
}

function main(argv) {
  const allowEmpty = argv.includes('--allow-empty');
  const targets = argv.filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('uso: check-16kb-alignment.js [--allow-empty] <aab|apk|dir|so>...');
    return 2;
  }
  const results = targets.flatMap(checkTarget);
  for (const r of results) {
    const aligns = r.aligns ? ` p_align=[${r.aligns.map((a) => `0x${a.toString(16)}`).join(',')}]` : '';
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.abi.padEnd(10)} ${r.file}${aligns}`);
    for (const reason of r.reasons) console.log(`       - ${reason}`);
  }
  const failed = results.filter((r) => !r.ok);
  const missingAbis = CHECKED_ABIS.filter((abi) => !results.some((r) => r.abi === abi));
  console.log(`\n16 KB: ${results.length} .so verificadas (${CHECKED_ABIS.join(', ')}); ${failed.length} com problema.`);
  if (failed.length > 0) {
    console.error('::error::Há bibliotecas nativas não compatíveis com páginas de 16 KB (o Play Console rejeita/avisa).');
    return 1;
  }
  if (!allowEmpty && missingAbis.length > 0) {
    console.error(`::error::Nenhuma .so encontrada para: ${missingAbis.join(', ')} (caminho errado ou libs removidas?).`);
    return 1;
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { abiOf, checkElf, checkTarget, checkZip, readZipEntries, PAGE_SIZE };
