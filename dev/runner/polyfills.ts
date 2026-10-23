// Web APIs that Vite's ModuleRunner uses and bare V8 inside Puerts does not provide.
const g = globalThis as any;

// React Fast Refresh (plugin-react's /@react-refresh runtime and the per-module wrapper Vite emits) addresses
// the global object as `window` at module evaluation.
if (typeof g.window === 'undefined') g.window = g;

if (typeof g.queueMicrotask !== 'function') {
  g.queueMicrotask = (fn: () => void) => Promise.resolve().then(fn);
}

if (typeof g.TextEncoder !== 'function') {
  g.TextEncoder = class TextEncoder {
    readonly encoding = 'utf-8';
    encode(text = ''): Uint8Array {
      const bytes: number[] = [];
      for (const ch of text) {
        let c = ch.codePointAt(0)!;
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
      return new Uint8Array(bytes);
    }
  };
}

if (typeof g.TextDecoder !== 'function') {
  g.TextDecoder = class TextDecoder {
    readonly encoding = 'utf-8';
    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return '';
      const b = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      let out = '';
      for (let i = 0; i < b.length; ) {
        const c = b[i++];
        let cp: number;
        if (c < 0x80) cp = c;
        else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
        else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
        else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
        out += String.fromCodePoint(cp);
      }
      return out;
    }
  };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
if (typeof g.atob !== 'function') {
  g.atob = (data: string) => {
    const s = String(data).replace(/[\s=]+/g, '');
    let out = '';
    for (let i = 0, bits = 0, acc = 0; i < s.length; i++) {
      acc = (acc << 6) | B64.indexOf(s[i]);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out += String.fromCharCode((acc >> bits) & 255);
      }
    }
    return out;
  };
}
if (typeof g.btoa !== 'function') {
  g.btoa = (data: string) => {
    let out = '';
    for (let i = 0; i < data.length; i += 3) {
      const n = (data.charCodeAt(i) << 16) | ((data.charCodeAt(i + 1) || 0) << 8) | (data.charCodeAt(i + 2) || 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < data.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < data.length ? B64[n & 63] : '=');
    }
    return out;
  };
}

// Absolute URLs only (scheme://host/path?query#hash), which is all the runner builds.
if (typeof g.URL !== 'function') {
  g.URL = class URL {
    protocol: string;
    host: string;
    pathname: string;
    search: string;
    hash: string;
    constructor(url: string, base?: string) {
      const text = base && !/^[a-z][a-z0-9+.-]*:/i.test(url) ? base.replace(/[^/]*$/, '') + url : url;
      const m = /^([a-z][a-z0-9+.-]*:)(?:\/\/([^/?#]*))?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(text);
      if (!m) throw new TypeError(`Invalid URL: ${url}`);
      this.protocol = m[1].toLowerCase();
      this.host = m[2] ?? '';
      this.pathname = m[3] || '/';
      this.search = m[4] ?? '';
      this.hash = m[5] ?? '';
    }
    get hostname() {
      return this.host.replace(/:\d+$/, '');
    }
    get port() {
      return /:(\d+)$/.exec(this.host)?.[1] ?? '';
    }
    get origin() {
      return `${this.protocol}//${this.host}`;
    }
    get href() {
      return `${this.protocol}//${this.host}${this.pathname}${this.search}${this.hash}`;
    }
    toString() {
      return this.href;
    }
  };
}
