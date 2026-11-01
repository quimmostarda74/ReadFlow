// Simulação mínima de DOM + IndexedDB para executar os ecrãs em Node.
const path = require('path').join(__dirname, '..', 'app', 'js') + '/';
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.nodeType = 1; this.value = ''; this.children = []; this.style = { setProperty(k, v) { this[k] = v; } }; this.className = '';
    this.attrs = {}; this.listeners = {}; this.parentNode = null; this._html = ''; this.textContent = '';
    const self = this;
    this.classList = { add: (c) => { if (!self.className.split(' ').includes(c)) self.className += ' ' + c; },
      remove: (c) => { self.className = self.className.split(' ').filter((x) => x !== c).join(' '); },
      toggle: (c, f) => (f ? self.classList.add(c) : self.classList.remove(c)), contains: (c) => self.className.split(' ').includes(c) }; }
  append(...n) { for (const x of n) { this.children.push(x); if (x && typeof x === 'object') x.parentNode = this; } }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); }
  set innerHTML(v) { this._html = v; } get innerHTML() { return this._html; }
  focus() {} select() {} click() {} setPointerCapture() {}
  getBoundingClientRect() { return { width: 680, height: 470 }; }
  get clientWidth() { return 1100; }
  getContext() { return new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true }); }
  toBlob(cb) { cb(new Blob(['x'])); }
}
const textNode = (t) => ({ nodeType: 3, text: String(t) });
const roots = [];
const doc = { listeners: {}, title: '', body: new El('body'), documentElement: new El('html'),
  createElement: (t) => new El(t), createTextNode: textNode,
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  removeEventListener() {},
  getElementById(id) { const find = (n) => { if (!n || n.nodeType !== 1) return null; if (n.attrs.id === id) return n; for (const c of n.children) { const r = find(c); if (r) return r; } return null; }; for (const r of roots) { const x = find(r); if (x) return x; } return null; },
  activeElement: { tagName: 'BODY' } };
for (const id of ['app', 'layer', 'toasts']) { const e = new El('div'); e.attrs.id = id; roots.push(e); }
global.window = globalThis; global.document = doc; globalThis.addEventListener = () => {};
global.setPointerCapture = () => {};
let _errs = 0; const origErr = console.error; console.error = (...a) => { _errs++; origErr(...a); };
const text = (n) => (!n ? '' : n.nodeType === 3 ? n.text : (n.children || []).map(text).join(' '));

// IndexedDB falso
const data = {};
global.indexedDB = { open() { const req = {}; setTimeout(() => {
  const db = { objectStoreNames: { contains: (n) => n in data }, createObjectStore: (n) => { data[n] = new Map(); },
    transaction(store) { const t = {}; const st = data[store];
      t.objectStore = () => ({
        put: (o) => { st.set(o.id, o); return { get result() { return o.id; } }; },
        delete: (id) => { st.delete(id); return {}; },
        clear: () => { st.clear(); return {}; },
        get: (id) => ({ get result() { return st.get(id); } }),
        getAll: () => ({ get result() { return [...st.values()]; } }) });
      setTimeout(() => t.oncomplete && t.oncomplete(), 0); return t; } };
  req.result = db; req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess && req.onsuccess(); }, 0); return req; } };

for (const f of ['logic', 'i18n', 'i18n-data', 'config', 'store', 'components', 'layout', 'catalog', 'social', 'remote', 'shelf', 'dialogs', 'session', 'views', 'app']) require(path + f + '.js');
const RF = globalThis.RF;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log('OK   ' + m);


module.exports = { El, roots, doc, text, sleep, ok, data, RF, errs: () => _errs };
