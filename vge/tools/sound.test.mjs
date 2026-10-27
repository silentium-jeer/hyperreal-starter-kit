import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { prepareSound } from '../content/sound.mjs';

const SAMPLE_RATE = 8000;

function writePcm16(path, channels, seconds, amplitude) {
  const frames = Math.round(seconds * SAMPLE_RATE);
  const bytes = Buffer.alloc(44 + frames * channels * 2);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + frames * channels * 2, 4);
  bytes.write('WAVEfmt ', 8, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * channels * 2, 28);
  bytes.writeUInt16LE(channels * 2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(frames * channels * 2, 40);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = amplitude * Math.sin((frame / SAMPLE_RATE) * 2 * Math.PI * 220 * (channel + 1));
      bytes.writeInt16LE(Math.round(sample * 0x7fff), 44 + (frame * channels + channel) * 2);
    }
  }
  writeFileSync(path, bytes);
}

function peakOfWav(path) {
  const bytes = readFileSync(path);
  let peak = 0;
  for (let offset = 44; offset < bytes.length; offset += 2) peak = Math.max(peak, Math.abs(bytes.readInt16LE(offset)) / 0x7fff);
  return { channels: bytes.readUInt16LE(22), peak };
}

function withFolder(run) {
  const folder = mkdtempSync(join(tmpdir(), 'vge-sound-'));
  return Promise.resolve(run(folder)).finally(() => rmSync(folder, { recursive: true, force: true }));
}

test('a short stereo clip becomes mono', () => withFolder(async (folder) => {
  writePcm16(join(folder, 'in.wav'), 2, 1, 0.5);
  const result = await prepareSound(join(folder, 'in.wav'), join(folder, 'out.wav'));
  assert.equal(result.channels, 1);
  assert.equal(peakOfWav(join(folder, 'out.wav')).channels, 1);
}));

test('a long stereo track stays stereo', () => withFolder(async (folder) => {
  writePcm16(join(folder, 'in.wav'), 2, 13, 0.5);
  const result = await prepareSound(join(folder, 'in.wav'), join(folder, 'out.wav'));
  assert.equal(result.channels, 2);
  assert.equal(peakOfWav(join(folder, 'out.wav')).channels, 2);
}));

test('a clipping peak comes down to 0.97 and a quiet one is not boosted', () => withFolder(async (folder) => {
  writePcm16(join(folder, 'loud.wav'), 1, 1, 1);
  writePcm16(join(folder, 'quiet.wav'), 1, 1, 0.25);
  await prepareSound(join(folder, 'loud.wav'), join(folder, 'loud-out.wav'));
  await prepareSound(join(folder, 'quiet.wav'), join(folder, 'quiet-out.wav'));
  assert.ok(Math.abs(peakOfWav(join(folder, 'loud-out.wav')).peak - 0.97) < 0.001);
  assert.ok(Math.abs(peakOfWav(join(folder, 'quiet-out.wav')).peak - 0.25) < 0.001);
}));

test('opting out copies the file untouched', () => withFolder(async (folder) => {
  writePcm16(join(folder, 'in.wav'), 2, 1, 1);
  const result = await prepareSound(join(folder, 'in.wav'), join(folder, 'out.wav'), { optimize: false });
  assert.equal(result.optimized, false);
  assert.deepEqual(readFileSync(result.file), readFileSync(join(folder, 'in.wav')));
}));
