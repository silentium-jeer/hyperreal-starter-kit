import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { MPEGDecoder } from 'mpg123-decoder';

export const SOUND = /\.(wav|mp3|ogg|flac|opus|aif|aiff)$/i;
const LONG_TRACK_DURATION_SECONDS = 12;
const TARGET_PEAK = 0.97;

export const isSound = (path) => SOUND.test(path);

function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a RIFF WAVE file');
  let format;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') format = { code: view.getUint16(body, true), channels: view.getUint16(body + 2, true), sampleRate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true) };
    if (id === 'data' && format) return { ...format, data: bytes.subarray(body, body + size) };
    offset = body + size + (size % 2);
  }
  throw new Error('WAVE file without fmt and data chunks');
}

function wavChannels({ code, channels, sampleRate, bits, data }) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = bits / 8;
  const frames = Math.floor(data.byteLength / (width * channels));
  const read = code === 3 && bits === 32 ? (at) => view.getFloat32(at, true)
    : bits === 16 ? (at) => view.getInt16(at, true) / 0x8000
    : bits === 24 ? (at) => ((view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getInt8(at + 2) << 16)) / 0x800000)
    : bits === 32 ? (at) => view.getInt32(at, true) / 0x80000000
    : bits === 8 ? (at) => (view.getUint8(at) - 128) / 128
    : null;
  if (!read) throw new Error(`unsupported WAVE sample format: ${bits} bits, format ${code}`);
  const channelData = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) channelData[channel][frame] = read((frame * channels + channel) * width);
  }
  return { channelData, sampleRate };
}

async function decode(path, bytes) {
  if (/\.wav$/i.test(path)) return wavChannels(readWav(bytes));
  if (!/\.mp3$/i.test(path)) return null;
  const decoder = new MPEGDecoder({ enableGapless: true });
  await decoder.ready;
  try {
    const decoded = decoder.decode(bytes);
    return { channelData: decoded.channelData, sampleRate: decoded.sampleRate };
  } finally {
    decoder.free();
  }
}

const peakOf = (channelData) => channelData.reduce((peak, channel) => channel.reduce((most, sample) => Math.max(most, Math.abs(sample)), peak), 0);

function mixToMono(channelData) {
  if (channelData.length === 1) return channelData;
  const length = Math.min(...channelData.map((channel) => channel.length));
  const mono = new Float32Array(length);
  for (let index = 0; index < length; index++) mono[index] = channelData.reduce((sum, channel) => sum + channel[index], 0) / channelData.length;
  return [mono];
}

function writeWav(path, channelData, sampleRate, gain) {
  const channels = channelData.length;
  const frames = channelData[0].length;
  const bytes = Buffer.alloc(44 + frames * channels * 2);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + frames * channels * 2, 4);
  bytes.write('WAVEfmt ', 8, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * channels * 2, 28);
  bytes.writeUInt16LE(channels * 2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(frames * channels * 2, 40);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] * gain));
      bytes.writeInt16LE(sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff), 44 + (frame * channels + channel) * 2);
    }
  }
  writeFileSync(path, bytes);
}

export async function prepareSound(source, target, { optimize = true } = {}) {
  const bytes = readFileSync(source);
  const decoded = optimize ? await decode(source, bytes) : null;
  if (!decoded) {
    const passed = target.replace(/\.[^.]+$/, source.slice(source.lastIndexOf('.')));
    copyFileSync(source, passed);
    return { file: passed, optimized: false };
  }
  const { channelData, sampleRate } = decoded;
  const seconds = channelData[0].length / sampleRate;
  const channels = channelData.length > 1 && seconds >= LONG_TRACK_DURATION_SECONDS ? channelData.slice(0, 2) : mixToMono(channelData);
  const peak = peakOf(channels);
  const gain = peak > TARGET_PEAK ? TARGET_PEAK / peak : 1;
  writeWav(target, channels, sampleRate, gain);
  return { file: target, optimized: true, seconds, channels: channels.length, sampleRate, sourcePeak: peak, gain };
}
