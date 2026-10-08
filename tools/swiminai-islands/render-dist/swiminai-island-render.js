import { useEffect as e, useLayoutEffect as t, useMemo as n, useRef as r, useState as i, useSyncExternalStore as a } from "react";
import * as o from "three";
import { BufferAttribute as s, BufferGeometry as c, ClampToEdgeWrapping as l, CompressedTexture as u, CubeReflectionMapping as d, DataTexture as f, FileLoader as p, FloatType as m, HalfFloatType as h, LinearFilter as g, LinearMipmapLinearFilter as _, Loader as v, NearestFilter as y, RGBAFormat as b, RGBA_ASTC_4x4_Format as x, RGBA_ASTC_6x6_Format as S, RGBA_BPTC_Format as C, RGBA_ETC2_EAC_Format as w, RGBA_PVRTC_4BPPV1_Format as T, RGBA_S3TC_DXT5_Format as E, RGB_ETC1_Format as D, RGB_ETC2_Format as O, RGB_PVRTC_4BPPV1_Format as k, RGB_S3TC_DXT1_Format as A, RGFormat as j, RedFormat as M, Texture as N, UnsignedByteType as P } from "three";
import { useGLTF as F } from "@react-three/drei";
import { useFrame as ee, useThree as te } from "@react-three/fiber";
//#region \0rolldown/runtime.js
var ne = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), re = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : e)(function(e) {
	if (typeof require < "u") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + e + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
}), ie = (e, t) => {
	let n = e[0].index !== null, r = new Set(Object.keys(e[0].attributes)), i = new Set(Object.keys(e[0].morphAttributes)), a = {}, o = {}, s = e[0].morphTargetsRelative, l = new c(), u = 0;
	if (e.forEach((e, c) => {
		let d = 0;
		if (n !== (e.index !== null)) return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + c + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."), null;
		for (let t in e.attributes) {
			if (!r.has(t)) return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + c + ". All geometries must have compatible attributes; make sure \"" + t + "\" attribute exists among all geometries, or in none of them."), null;
			a[t] === void 0 && (a[t] = []), a[t].push(e.attributes[t]), d++;
		}
		if (d !== r.size) return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + c + ". Make sure all geometries have the same number of attributes."), null;
		if (s !== e.morphTargetsRelative) return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + c + ". .morphTargetsRelative must be consistent throughout all geometries."), null;
		for (let t in e.morphAttributes) {
			if (!i.has(t)) return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + c + ".  .morphAttributes must be consistent throughout all geometries."), null;
			o[t] === void 0 && (o[t] = []), o[t].push(e.morphAttributes[t]);
		}
		if (l.userData.mergedUserData = l.userData.mergedUserData || [], l.userData.mergedUserData.push(e.userData), t) {
			let t;
			if (e.index) t = e.index.count;
			else if (e.attributes.position !== void 0) t = e.attributes.position.count;
			else return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + c + ". The geometry must have either an index or a position attribute"), null;
			l.addGroup(u, t, c), u += t;
		}
	}), n) {
		let t = 0, n = [];
		e.forEach((e) => {
			let r = e.index;
			for (let e = 0; e < r.count; ++e) n.push(r.getX(e) + t);
			t += e.attributes.position.count;
		}), l.setIndex(n);
	}
	for (let e in a) {
		let t = ae(a[e]);
		if (!t) return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the " + e + " attribute."), null;
		l.setAttribute(e, t);
	}
	for (let e in o) {
		let t = o[e][0].length;
		if (t === 0) break;
		l.morphAttributes = l.morphAttributes || {}, l.morphAttributes[e] = [];
		for (let n = 0; n < t; ++n) {
			let t = [];
			for (let r = 0; r < o[e].length; ++r) t.push(o[e][r][n]);
			let r = ae(t);
			if (!r) return console.error("THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the " + e + " morphAttribute."), null;
			l.morphAttributes[e].push(r);
		}
	}
	return l;
}, ae = (e) => {
	let t, n, r, i = 0;
	if (e.forEach((e) => {
		if (t === void 0 && (t = e.array.constructor), t !== e.array.constructor) return console.error("THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."), null;
		if (n === void 0 && (n = e.itemSize), n !== e.itemSize) return console.error("THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."), null;
		if (r === void 0 && (r = e.normalized), r !== e.normalized) return console.error("THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."), null;
		i += e.array.length;
	}), t && n) {
		let a = new t(i), o = 0;
		return e.forEach((e) => {
			a.set(e.array, o), o += e.array.length;
		}), new s(a, n, r);
	}
};
function oe(e, t = 1e-4) {
	t = Math.max(t, 2 ** -52);
	let n = {}, r = e.getIndex(), i = e.getAttribute("position"), a = r ? r.count : i.count, o = 0, c = Object.keys(e.attributes), l = {}, u = {}, d = [], f = [
		"getX",
		"getY",
		"getZ",
		"getW"
	];
	for (let t = 0, n = c.length; t < n; t++) {
		let n = c[t];
		l[n] = [];
		let r = e.morphAttributes[n];
		r && (u[n] = Array(r.length).fill(0).map(() => []));
	}
	let p = 10 ** Math.log10(1 / t);
	for (let t = 0; t < a; t++) {
		let i = r ? r.getX(t) : t, a = "";
		for (let t = 0, n = c.length; t < n; t++) {
			let n = c[t], r = e.getAttribute(n), o = r.itemSize;
			for (let e = 0; e < o; e++) a += `${~~(r[f[e]](i) * p)},`;
		}
		if (a in n) d.push(n[a]);
		else {
			for (let t = 0, n = c.length; t < n; t++) {
				let n = c[t], r = e.getAttribute(n), a = e.morphAttributes[n], o = r.itemSize, s = l[n], d = u[n];
				for (let e = 0; e < o; e++) {
					let t = f[e];
					if (s.push(r[t](i)), a) for (let e = 0, n = a.length; e < n; e++) d[e].push(a[e][t](i));
				}
			}
			n[a] = o, d.push(o), o++;
		}
	}
	let m = e.clone();
	for (let t = 0, n = c.length; t < n; t++) {
		let n = c[t], r = e.getAttribute(n), i = new r.array.constructor(l[n]), a = new s(i, r.itemSize, r.normalized);
		if (m.setAttribute(n, a), n in u) for (let t = 0; t < u[n].length; t++) {
			let r = e.morphAttributes[n][t], i = new r.array.constructor(u[n][t]), a = new s(i, r.itemSize, r.normalized);
			m.morphAttributes[n][t] = a;
		}
	}
	return m.setIndex(d), m;
}
//#endregion
//#region ../../node_modules/.pnpm/three-stdlib@2.36.1_three@0.185.1/node_modules/three-stdlib/_polyfill/Data3DTexture.js
var se = class extends N {
	constructor(e = null, t = 1, n = 1, r = 1) {
		super(null), this.isData3DTexture = !0, this.image = {
			data: e,
			width: t,
			height: n,
			depth: r
		}, this.magFilter = y, this.minFilter = y, this.wrapR = l, this.generateMipmaps = !1, this.flipY = !1, this.unpackAlignment = 1;
	}
}, ce = class {
	constructor(e = 4) {
		this.pool = e, this.queue = [], this.workers = [], this.workersResolve = [], this.workerStatus = 0;
	}
	_initWorker(e) {
		if (!this.workers[e]) {
			let t = this.workerCreator();
			t.addEventListener("message", this._onMessage.bind(this, e)), this.workers[e] = t;
		}
	}
	_getIdleWorker() {
		for (let e = 0; e < this.pool; e++) if (!(this.workerStatus & 1 << e)) return e;
		return -1;
	}
	_onMessage(e, t) {
		let n = this.workersResolve[e];
		if (n && n(t), this.queue.length) {
			let { resolve: t, msg: n, transfer: r } = this.queue.shift();
			this.workersResolve[e] = t, this.workers[e].postMessage(n, r);
		} else this.workerStatus ^= 1 << e;
	}
	setWorkerCreator(e) {
		this.workerCreator = e;
	}
	setWorkerLimit(e) {
		this.pool = e;
	}
	postMessage(e, t) {
		return new Promise((n) => {
			let r = this._getIdleWorker();
			r === -1 ? this.queue.push({
				resolve: n,
				msg: e,
				transfer: t
			}) : (this._initWorker(r), this.workerStatus |= 1 << r, this.workersResolve[r] = n, this.workers[r].postMessage(e, t));
		});
	}
	dispose() {
		this.workers.forEach((e) => e.terminate()), this.workersResolve.length = 0, this.workers.length = 0, this.queue.length = 0, this.workerStatus = 0;
	}
}, le = class {
	constructor() {
		this.vkFormat = 0, this.typeSize = 1, this.pixelWidth = 0, this.pixelHeight = 0, this.pixelDepth = 0, this.layerCount = 0, this.faceCount = 1, this.supercompressionScheme = 0, this.levels = [], this.dataFormatDescriptor = [{
			vendorId: 0,
			descriptorType: 0,
			descriptorBlockSize: 0,
			versionNumber: 2,
			colorModel: 0,
			colorPrimaries: 1,
			transferFunction: 2,
			flags: 0,
			texelBlockDimension: [
				0,
				0,
				0,
				0
			],
			bytesPlane: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			],
			samples: []
		}], this.keyValue = {}, this.globalData = null;
	}
}, ue = class {
	constructor(e, t, n, r) {
		this._dataView = void 0, this._littleEndian = void 0, this._offset = void 0, this._dataView = new DataView(e.buffer, e.byteOffset + t, n), this._littleEndian = r, this._offset = 0;
	}
	_nextUint8() {
		let e = this._dataView.getUint8(this._offset);
		return this._offset += 1, e;
	}
	_nextUint16() {
		let e = this._dataView.getUint16(this._offset, this._littleEndian);
		return this._offset += 2, e;
	}
	_nextUint32() {
		let e = this._dataView.getUint32(this._offset, this._littleEndian);
		return this._offset += 4, e;
	}
	_nextUint64() {
		let e = this._dataView.getUint32(this._offset, this._littleEndian) + 2 ** 32 * this._dataView.getUint32(this._offset + 4, this._littleEndian);
		return this._offset += 8, e;
	}
	_nextInt32() {
		let e = this._dataView.getInt32(this._offset, this._littleEndian);
		return this._offset += 4, e;
	}
	_nextUint8Array(e) {
		let t = new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + this._offset, e);
		return this._offset += e, t;
	}
	_skip(e) {
		return this._offset += e, this;
	}
	_scan(e, t) {
		t === void 0 && (t = 0);
		let n = this._offset, r = 0;
		for (; this._dataView.getUint8(this._offset) !== t && r < e;) r++, this._offset++;
		return r < e && this._offset++, new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + n, r);
	}
}, I = [
	171,
	75,
	84,
	88,
	32,
	50,
	48,
	187,
	13,
	10,
	26,
	10
];
function de(e) {
	return typeof TextDecoder < "u" ? new TextDecoder().decode(e) : Buffer.from(e).toString("utf8");
}
function fe(e) {
	let t = new Uint8Array(e.buffer, e.byteOffset, I.length);
	if (t[0] !== I[0] || t[1] !== I[1] || t[2] !== I[2] || t[3] !== I[3] || t[4] !== I[4] || t[5] !== I[5] || t[6] !== I[6] || t[7] !== I[7] || t[8] !== I[8] || t[9] !== I[9] || t[10] !== I[10] || t[11] !== I[11]) throw Error("Missing KTX 2.0 identifier.");
	let n = new le(), r = 17 * Uint32Array.BYTES_PER_ELEMENT, i = new ue(e, I.length, r, !0);
	n.vkFormat = i._nextUint32(), n.typeSize = i._nextUint32(), n.pixelWidth = i._nextUint32(), n.pixelHeight = i._nextUint32(), n.pixelDepth = i._nextUint32(), n.layerCount = i._nextUint32(), n.faceCount = i._nextUint32();
	let a = i._nextUint32();
	n.supercompressionScheme = i._nextUint32();
	let o = i._nextUint32(), s = i._nextUint32(), c = i._nextUint32(), l = i._nextUint32(), u = i._nextUint64(), d = i._nextUint64(), f = a * 3 * 8, p = new ue(e, I.length + r, f, !0);
	for (let t = 0; t < a; t++) n.levels.push({
		levelData: new Uint8Array(e.buffer, e.byteOffset + p._nextUint64(), p._nextUint64()),
		uncompressedByteLength: p._nextUint64()
	});
	let m = new ue(e, o, s, !0), h = {
		vendorId: m._skip(4)._nextUint16(),
		descriptorType: m._nextUint16(),
		versionNumber: m._nextUint16(),
		descriptorBlockSize: m._nextUint16(),
		colorModel: m._nextUint8(),
		colorPrimaries: m._nextUint8(),
		transferFunction: m._nextUint8(),
		flags: m._nextUint8(),
		texelBlockDimension: [
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8()
		],
		bytesPlane: [
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8(),
			m._nextUint8()
		],
		samples: []
	}, g = (h.descriptorBlockSize / 4 - 6) / 4;
	for (let e = 0; e < g; e++) {
		let t = {
			bitOffset: m._nextUint16(),
			bitLength: m._nextUint8(),
			channelType: m._nextUint8(),
			samplePosition: [
				m._nextUint8(),
				m._nextUint8(),
				m._nextUint8(),
				m._nextUint8()
			],
			sampleLower: -Infinity,
			sampleUpper: Infinity
		};
		t.channelType & 64 ? (t.sampleLower = m._nextInt32(), t.sampleUpper = m._nextInt32()) : (t.sampleLower = m._nextUint32(), t.sampleUpper = m._nextUint32()), h.samples[e] = t;
	}
	n.dataFormatDescriptor.length = 0, n.dataFormatDescriptor.push(h);
	let _ = new ue(e, c, l, !0);
	for (; _._offset < l;) {
		let e = _._nextUint32(), t = _._scan(e), r = de(t);
		if (n.keyValue[r] = _._nextUint8Array(e - t.byteLength - 1), r.match(/^ktx/i)) {
			let e = de(n.keyValue[r]);
			n.keyValue[r] = e.substring(0, e.lastIndexOf("\0"));
		}
		let i = e % 4 ? 4 - e % 4 : 0;
		_._skip(i);
	}
	if (d <= 0) return n;
	let v = new ue(e, u, d, !0), y = v._nextUint16(), b = v._nextUint16(), x = v._nextUint32(), S = v._nextUint32(), C = v._nextUint32(), w = v._nextUint32(), T = [];
	for (let e = 0; e < a; e++) T.push({
		imageFlags: v._nextUint32(),
		rgbSliceByteOffset: v._nextUint32(),
		rgbSliceByteLength: v._nextUint32(),
		alphaSliceByteOffset: v._nextUint32(),
		alphaSliceByteLength: v._nextUint32()
	});
	let E = u + v._offset, D = E + x, O = D + S, k = O + C;
	return n.globalData = {
		endpointCount: y,
		selectorCount: b,
		imageDescs: T,
		endpointsData: new Uint8Array(e.buffer, e.byteOffset + E, x),
		selectorsData: new Uint8Array(e.buffer, e.byteOffset + D, S),
		tablesData: new Uint8Array(e.buffer, e.byteOffset + O, C),
		extendedData: new Uint8Array(e.buffer, e.byteOffset + k, w)
	}, n;
}
//#endregion
//#region ../../node_modules/.pnpm/three-stdlib@2.36.1_three@0.185.1/node_modules/three-stdlib/libs/zstddec.js
var pe, me, he, ge = { env: { emscripten_notify_memory_growth: function(e) {
	he = new Uint8Array(me.exports.memory.buffer);
} } }, _e = class {
	init() {
		return pe || (pe = typeof fetch < "u" ? fetch("data:application/wasm;base64," + ve).then((e) => e.arrayBuffer()).then((e) => WebAssembly.instantiate(e, ge)).then(this._init) : WebAssembly.instantiate(Buffer.from(ve, "base64"), ge).then(this._init), pe);
	}
	_init(e) {
		me = e.instance, ge.env.emscripten_notify_memory_growth(0);
	}
	decode(e, t = 0) {
		if (!me) throw Error("ZSTDDecoder: Await .init() before decoding.");
		let n = e.byteLength, r = me.exports.malloc(n);
		he.set(e, r), t ||= Number(me.exports.ZSTD_findDecompressedSize(r, n));
		let i = me.exports.malloc(t), a = me.exports.ZSTD_decompress(i, t, r, n), o = he.slice(i, i + a);
		return me.exports.free(r), me.exports.free(i), o;
	}
}, ve = "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IAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAACy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAIajYCACADCy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAFajYCACADCx8AIAAgASACKAIEEAg2AgAgARAEGiAAIAJBCGo2AgQLCAAgAGdBH3MLugUBDX8jAEEQayIKJAACfyAEQQNNBEAgCkEANgIMIApBDGogAyAEEAsaIAAgASACIApBDGpBBBAVIgBBbCAAEAMbIAAgACAESxsMAQsgAEEAIAEoAgBBAXRBAmoQECENQVQgAygAACIGQQ9xIgBBCksNABogAiAAQQVqNgIAIAMgBGoiAkF8aiEMIAJBeWohDiACQXtqIRAgAEEGaiELQQQh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ASIDNgLE4AEgACgCvOABIQQgACABNgK84AEgACABIAJqNgK44AEgACABIAQgA2tqNgLA4AELpgEBAX8gACAAKALs4QEQFjYCyOABIABCADcD+OABIABCADcDuOABIABBwOABakIANwMAIABBqNAAaiIBQYyAgOAANgIAIABBADYCmOIBIABCADcDiOEBIABCAzcDgOEBIABBrNABakHgEikCADcCACAAQbTQAWpB6BIoAgA2AgAgACABNgIMIAAgAEGYIGo2AgggACAAQaAwajYCBCAAIABBEGo2AgALYQEBf0G4fyEDAkAgAUEDSQ0AIAIgABAhIgFBA3YiADYCCCACIAFBAXE2AgQgAiABQQF2QQNxIgM2AgACQCADQX9qIgFBAksNAAJAIAFBAWsOAgEAAgtBbA8LIAAhAwsgAwsMACAAIAEgAkEAEC4LiAQCA38CfiADEBYhBCAAQQBBKBAQIQAgBCACSwRAIAQPCyABRQRAQX8PCwJAAkAgA0EBRg0AIAEoAAAiBkGo6r5pRg0AQXYhAyAGQXBxQdDUtMIBRw0BQQghAyACQQhJDQEgAEEAQSgQECEAIAEoAAQhASAAQQE2AhQgACABrTcDAEEADwsgASACIAMQLyIDIAJLDQAgACADNgIYQXIhAyABIARqIgVBf2otAAAiAkEIcQ0AIAJBIHEiBkUEQEFwIQMgBS0AACIFQacBSw0BIAVBB3GtQgEgBUEDdkEKaq2GIgdCA4h+IAd8IQggBEEBaiEECyACQQZ2IQMgAkECdiEFAkAgAkEDcUF/aiICQQJLBEBBACECDAELAkACQAJAIAJBAWsOAgECAAsgASAEai0AACECIARBAWohBAwCCyABIARqLwAAIQIgBEECaiEEDAELIAEgBGooAAAhAiAEQQRqIQQLIAVBAXEhBQJ+AkACQAJAIANBf2oiA0ECTQRAIANBAWsOAgIDAQtCfyAGRQ0DGiABIARqMQAADAMLIAEgBGovAACtQoACfAwCCyABIARqKAAArQwBCyABIARqKQAACyEHIAAgBTYCICAAIAI2AhwgACAHNwMAQQAhAyAAQQA2AhQgACAHIAggBhsiBzcDCCAAIAdCgIAIIAdCgIAIVBs+AhALIAMLWwEBf0G4fyEDIAIQFiICIAFNBH8gACACakF/ai0AACIAQQNxQQJ0QaAeaigC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C0Egak8NAQsgByAHKQNoNwMQIAcgBykDYDcDCCAEIA0gB0EIaiAHQdwAaiAPIA4gESAQEB4hCwwBCyACIARqIQggBCAKEAcgAkERTwRAIARBEGohAgNAIAIgCkEQaiIKEAcgAkEQaiICIAhJDQALCyAIIAlrIQIgByATNgJcIAkgCCAOa0sEQCAJIAggEWtLBEBBbCELDAILIBAgAiAOayICaiIKIANqIBBNBEAgCCAKIAMQDxoMAgsgCCAKQQAgAmsQDyEIIAcgAiADaiIDNgJkIAggAmshCCAOIQILIAlBEE8EQCADIAhqIQMDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALDAELAkAgCUEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgCUECdCIDQcAeaigCAGoiAhAXIAIgA0HgHmooAgBrIQIgBygCZCEDDAELIAggAhAMCyADQQlJDQAgAyAIaiEDIAhBCGoiCCACQQhqIgJrQQ9MBEADQCAIIAIQDCACQQhqIQIgCEEIaiIIIANJDQAMAgALAAsDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALCyAHQRhqEAQaIAsgDCALEAMiAhshDCAEIAQgC2ogAhshBCAFQX9qIgUNAAsgDBADDQFBbCEMIAdBGGoQBEECSQ0BQQAhCANAIAhBA0cEQCAAIAhBAnQiAmpBrNABaiACIAdqKAJENgIAIAhBAWohCAwBCwsgBygCXCEIC0G6fyEMIA8gCGsiACANIARrSw0AIAQEfyAEIAggABALIABqBUEACyABayEMCyAHQfAAaiQAIAwLkRcCFn8FfiMAQdABayIHJAAgByAAKALw4QEiCDYCvAEgASACaiESIAggACgCgOIBaiETAkACQCAFRQRAIAEhAwwBCyAAKALE4AEhESAAKALA4AEhFSAAKAK84AEhDyAAQQE2AozhAUEAIQgDQCAIQQNHBEAgByAIQQJ0IgJqIAAgAmpBrNABaigCADYCVCAIQQFqIQgMAQsLIAcgETYCZCAHIA82AmAgByABIA9rNgJoQWwhECAHQShqIAMgBBAGEAMNASAFQQQgBUEESBshFyAHQTxqIAdBKGogACgCABATIAdBxABqIAdBKGogACgCCBATIAdBzABqIAdB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IAdB0AFqJAAgEAslACAAQgA3AgAgAEEAOwEIIABBADoACyAAIAE2AgwgACACOgAKC7QFAQN/IwBBMGsiBCQAIABB/wFqIgVBfWohBgJAIAMvAQIEQCAEQRhqIAEgAhAGIgIQAw0BIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahASOgAAIAMgBEEIaiAEQRhqEBI6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0FIAEgBEEQaiAEQRhqEBI6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBSABIARBCGogBEEYahASOgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEjoAACABIAJqIABrIQIMAwsgAyAEQRBqIARBGGoQEjoAAiADIARBCGogBEEYahASOgADIANBBGohAwwAAAsACyAEQRhqIAEgAhAGIgIQAw0AIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahAROgAAIAMgBEEIaiAEQRhqEBE6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0EIAEgBEEQaiAEQRhqEBE6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBCABIARBCGogBEEYahAROgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEToAACABIAJqIABrIQIMAgsgAyAEQRBqIARBGGoQEToAAiADIARBCGogBEEYahAROgADIANBBGohAwwAAAsACyAEQTBqJAAgAgtpAQF/An8CQAJAIAJBB00NACABKAAAQbfIwuF+Rw0AIAAgASgABDYCmOIBQWIgAEEQaiABIAIQPiIDEAMNAhogAEKBgICAEDcDiOEBIAAgASADaiACIANrECoMAQsgACABIAIQKgtBAAsLrQMBBn8jAEGAAWsiAyQAQWIhCAJAIAJBCUkNACAAQZjQAGogAUEIaiIEIAJBeGogAEGY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wOABCwutAgIEfwF+IwBBQGoiBCQAAkACQCACQQhJDQAgASgAAEFwcUHQ1LTCAUcNACABIAIQIiEBIABCADcDCCAAQQA2AgQgACABNgIADAELIARBGGogASACEC0iAxADBEAgACADEBoMAQsgAwRAIABBuH8QGgwBCyACIAQoAjAiA2shAiABIANqIQMDQAJAIAAgAyACIARBCGoQLCIFEAMEfyAFBSACIAVBA2oiBU8NAUG4fwsQGgwCCyAGQQFqIQYgAiAFayECIAMgBWohAyAEKAIMRQ0ACyAEKAI4BEAgAkEDTQRAIABBuH8QGgwCCyADQQRqIQMLIAQoAighAiAEKQMYIQcgAEEANgIEIAAgAyABazYCACAAIAIgBmytIAcgB0J/URs3AwgLIARBQGskAAslAQF/IwBBEGsiAiQAIAIgACABEFEgAigCACEAIAJBEGokACAAC30BBH8jAEGQBGsiBCQAIARB/wE2AggCQCAEQRBqIARBCGogBEEMaiABIAIQFSIGEAMEQCAGIQUMAQtBVCEFIAQoAgwiB0EGSw0AIAMgBEEQaiAEKAIIIAcQQSIFEAMNACAAIAEgBmogAiAGayADEDwhBQsgBEGQBGokACAFC4cBAgJ/An5BABAWIQMCQANAIAEgA08EQAJAIAAoAABBcHFB0NS0wgFGBEAgACABECIiAhADRQ0BQn4PCyAAIAEQVSIEQn1WDQMgBCAFfCIFIARUIQJCfiEEIAINAyAAIAEQUiICEAMNAwsgASACayEBIAAgAmohAAwBCwtCfiAFIAEbIQQLIAQLPwIBfwF+IwBBMGsiAiQAAn5CfiACQQhqIAAgARAtDQAaQgAgAigCHEEBRg0AGiACKQMICyEDIAJBMGokACADC40BAQJ/IwBBMGsiASQAAkAgAEUNACAAKAKI4gENACABIABB/OEBaigCADYCKCABIAApAvThATcDICAAEDAgACgCqOIBIQIgASABKAIoNgIYIAEgASkDIDcDECACIAFBEGoQGyAAQQA2AqjiASABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALKgECfyMAQRBrIgAkACAAQQA2AgggAEIANwMAIAAQWCEBIABBEGokACABC4cBAQN/IwBBEGsiAiQAAkAgACgCAEUgACgCBEVzDQAgAiAAKAIINgIIIAIgACkCADcDAAJ/IAIoAgAiAQRAIAIoAghBqOMJIAERBQAMAQtBqOMJECgLIgFFDQAgASAAKQIANwL04QEgAUH84QFqIAAoAgg2AgAgARBZIAEhAwsgAkEQaiQAIAMLywEBAn8jAEEgayIBJAAgAEGBgIDAADYCtOIBIABBADYCiOIBIABBADYC7OEBIABCADcDkOIBIABBADYCpOMJIABBADYC3OIBIABCADcCzOIBIABBADYCvOIBIABBADYCxOABIABCADcCnOIBIABBpOIBakIANwIAIABBrOIBakEANgIAIAFCADcCECABQgA3AhggASABKQMYNwMIIAEgASkDEDcDACABKAIIQQh2QQFxIQIgAEEANgLg4gEgACACNgKM4gEgAUEgaiQAC3YBA38jAEEwayIBJAAgAARAIAEgAEHE0AFqIgIoAgA2AiggASAAKQK80AE3AyAgACgCACEDIAEgAigCADYCGCABIAApArzQATcDECADIAFBEGoQGyABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALzAEBAX8gACABKAK00AE2ApjiASAAIAEoAgQiAjYCwOABIAAgAjYCvOABIAAgAiABKAIIaiICNgK44AEgACACNgLE4AEgASgCuNABBEAgAEKBgICAEDcDiOEBIAAgAUGk0ABqNgIMIAAgAUGUIGo2AgggACABQZwwajYCBCAAIAFBDGo2AgAgAEGs0AFqIAFBqNABaigCADYCACAAQbDQAWogAUGs0AFqKAIANgIAIABBtNABaiABQbDQAWooAgA2AgAPCyAAQgA3A4jhAQs7ACACRQRAQbp/DwsgBEUEQEFsDwsgAiAEEGAEQCAAIAEgAiADIAQgBRBhDwsgACABIAIgAyAEIAUQZQtGAQF/IwBBEGsiBSQAIAVBCGogBBAOAn8gBS0ACQRAIAAgASACIAMgBBAyDAELIAAgASACIAMgBBA0CyEAIAVBEGokACAACzQAIAAgAyAEIAUQNiIFEAMEQCAFDwsgBSAESQR/IAEgAiADIAVqIAQgBWsgABA1BUG4fwsLRgEBfyMAQRBrIgUkACAFQQhqIAQQDgJ/IAUtAAkEQCAAIAEgAiADIAQQYgwBCyAAIAEgAiADIAQQNQshACAFQRBqJAAgAAtZAQF/QQ8hAiABIABJBEAgAUEE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", ye = class extends u {
	constructor(e, t, n) {
		super(void 0, e[0].width, e[0].height, t, n, d), this.isCompressedCubeTexture = !0, this.isCubeTexture = !0, this.image = e;
	}
}, be = class extends u {
	constructor(e, t, n, r, i, a) {
		super(e, t, n, i, a), this.isCompressedArrayTexture = !0, this.image.depth = r, this.wrapR = l;
	}
}, xe = Object.defineProperty, Se = (e, t, n) => t in e ? xe(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, Ce = (e, t, n) => (Se(e, typeof t == "symbol" ? t : t + "", n), n), we = 3e3, Te = 3001, Ee = "", De = "display-p3", Oe = "display-p3-linear", ke = "srgb-linear", Ae = "srgb", je = /* @__PURE__ */ new WeakMap(), Me = 0, Ne, Pe = /* @__PURE__ */ (() => {
	let e = class extends v {
		constructor(e) {
			super(e), this.transcoderPath = "", this.transcoderBinary = null, this.transcoderPending = null, this.workerPool = new ce(), this.workerSourceURL = "", this.workerConfig = null, typeof MSC_TRANSCODER < "u" && console.warn("THREE.KTX2Loader: Please update to latest \"basis_transcoder\". \"msc_basis_transcoder\" is no longer supported in three.js r125+.");
		}
		setTranscoderPath(e) {
			return this.transcoderPath = e, this;
		}
		setWorkerLimit(e) {
			return this.workerPool.setWorkerLimit(e), this;
		}
		detectSupport(e) {
			return this.workerConfig = {
				astcSupported: e.extensions.has("WEBGL_compressed_texture_astc"),
				etc1Supported: e.extensions.has("WEBGL_compressed_texture_etc1"),
				etc2Supported: e.extensions.has("WEBGL_compressed_texture_etc"),
				dxtSupported: e.extensions.has("WEBGL_compressed_texture_s3tc"),
				bptcSupported: e.extensions.has("EXT_texture_compression_bptc"),
				pvrtcSupported: e.extensions.has("WEBGL_compressed_texture_pvrtc") || e.extensions.has("WEBKIT_WEBGL_compressed_texture_pvrtc")
			}, e.capabilities.isWebGL2 && (this.workerConfig.etc1Supported = !1), this;
		}
		init() {
			if (!this.transcoderPending) {
				let t = new p(this.manager);
				t.setPath(this.transcoderPath), t.setWithCredentials(this.withCredentials);
				let n = t.loadAsync("basis_transcoder.js"), r = new p(this.manager);
				r.setPath(this.transcoderPath), r.setResponseType("arraybuffer"), r.setWithCredentials(this.withCredentials);
				let i = r.loadAsync("basis_transcoder.wasm");
				this.transcoderPending = Promise.all([n, i]).then(([t, n]) => {
					let r = e.BasisWorker.toString(), i = [
						"/* constants */",
						"let _EngineFormat = " + JSON.stringify(e.EngineFormat),
						"let _TranscoderFormat = " + JSON.stringify(e.TranscoderFormat),
						"let _BasisFormat = " + JSON.stringify(e.BasisFormat),
						"/* basis_transcoder.js */",
						t,
						"/* worker */",
						r.substring(r.indexOf("{") + 1, r.lastIndexOf("}"))
					].join("\n");
					this.workerSourceURL = URL.createObjectURL(new Blob([i])), this.transcoderBinary = n, this.workerPool.setWorkerCreator(() => {
						let e = new Worker(this.workerSourceURL), t = this.transcoderBinary.slice(0);
						return e.postMessage({
							type: "init",
							config: this.workerConfig,
							transcoderBinary: t
						}, [t]), e;
					});
				}), Me > 0 && console.warn("THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues. Use a single KTX2Loader instance, or call .dispose() on old instances."), Me++;
			}
			return this.transcoderPending;
		}
		load(e, t, n, r) {
			if (this.workerConfig === null) throw Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");
			let i = new p(this.manager);
			i.setResponseType("arraybuffer"), i.setWithCredentials(this.withCredentials), i.load(e, (e) => {
				if (je.has(e)) return je.get(e).promise.then(t).catch(r);
				this._createTexture(e).then((e) => t ? t(e) : null).catch(r);
			}, n, r);
		}
		_createTextureFrom(e, t) {
			let { faces: n, width: r, height: i, format: a, type: o, error: s, dfdFlags: c } = e;
			if (o === "error") return Promise.reject(s);
			let l;
			if (t.faceCount === 6) l = new ye(n, a, P);
			else {
				let e = n[0].mipmaps;
				l = t.layerCount > 1 ? new be(e, r, i, t.layerCount, a, P) : new u(e, r, i, a, P);
			}
			l.minFilter = n[0].mipmaps.length === 1 ? g : _, l.magFilter = g, l.generateMipmaps = !1, l.needsUpdate = !0;
			let d = ze(t);
			return "colorSpace" in l ? l.colorSpace = d : l.encoding = d === Ae ? Te : we, l.premultiplyAlpha = !!(c & 1), l;
		}
		async _createTexture(e, t = {}) {
			let n = fe(new Uint8Array(e));
			if (n.vkFormat !== 0) return Re(n);
			let r = t, i = this.init().then(() => this.workerPool.postMessage({
				type: "transcode",
				buffer: e,
				taskConfig: r
			}, [e])).then((e) => this._createTextureFrom(e.data, n));
			return je.set(e, { promise: i }), i;
		}
		dispose() {
			return this.workerPool.dispose(), this.workerSourceURL && URL.revokeObjectURL(this.workerSourceURL), Me--, this;
		}
	}, t = e;
	return Ce(t, "BasisFormat", {
		ETC1S: 0,
		UASTC_4x4: 1
	}), Ce(t, "TranscoderFormat", {
		ETC1: 0,
		ETC2: 1,
		BC1: 2,
		BC3: 3,
		BC4: 4,
		BC5: 5,
		BC7_M6_OPAQUE_ONLY: 6,
		BC7_M5: 7,
		PVRTC1_4_RGB: 8,
		PVRTC1_4_RGBA: 9,
		ASTC_4x4: 10,
		ATC_RGB: 11,
		ATC_RGBA_INTERPOLATED_ALPHA: 12,
		RGBA32: 13,
		RGB565: 14,
		BGR565: 15,
		RGBA4444: 16
	}), Ce(t, "EngineFormat", {
		RGBAFormat: b,
		RGBA_ASTC_4x4_Format: x,
		RGBA_BPTC_Format: C,
		RGBA_ETC2_EAC_Format: w,
		RGBA_PVRTC_4BPPV1_Format: T,
		RGBA_S3TC_DXT5_Format: E,
		RGB_ETC1_Format: D,
		RGB_ETC2_Format: O,
		RGB_PVRTC_4BPPV1_Format: k,
		RGB_S3TC_DXT1_Format: A
	}), Ce(t, "BasisWorker", function() {
		let e, t, n, r = _EngineFormat, i = _TranscoderFormat, a = _BasisFormat;
		self.addEventListener("message", function(n) {
			let r = n.data;
			switch (r.type) {
				case "init":
					e = r.config, o(r.transcoderBinary);
					break;
				case "transcode": t.then(() => {
					try {
						let { faces: e, buffers: t, width: n, height: i, hasAlpha: a, format: o, dfdFlags: c } = s(r.buffer);
						self.postMessage({
							type: "transcode",
							id: r.id,
							faces: e,
							width: n,
							height: i,
							hasAlpha: a,
							format: o,
							dfdFlags: c
						}, t);
					} catch (e) {
						console.error(e), self.postMessage({
							type: "error",
							id: r.id,
							error: e.message
						});
					}
				});
			}
		});
		function o(e) {
			t = new Promise((t) => {
				n = {
					wasmBinary: e,
					onRuntimeInitialized: t
				}, BASIS(n);
			}).then(() => {
				n.initializeBasis(), n.KTX2File === void 0 && console.warn("THREE.KTX2Loader: Please update Basis Universal transcoder.");
			});
		}
		function s(e) {
			let t = new n.KTX2File(new Uint8Array(e));
			function r() {
				t.close(), t.delete();
			}
			if (!t.isValid()) throw r(), Error("THREE.KTX2Loader:	Invalid or unsupported .ktx2 file");
			let i = t.isUASTC() ? a.UASTC_4x4 : a.ETC1S, o = t.getWidth(), s = t.getHeight(), c = t.getLayers() || 1, l = t.getLevels(), u = t.getFaces(), f = t.getHasAlpha(), m = t.getDFDFlags(), { transcoderFormat: h, engineFormat: g } = d(i, o, s, f);
			if (!o || !s || !l) throw r(), Error("THREE.KTX2Loader:	Invalid texture");
			if (!t.startTranscoding()) throw r(), Error("THREE.KTX2Loader: .startTranscoding failed");
			let _ = [], v = [];
			for (let e = 0; e < u; e++) {
				let n = [];
				for (let i = 0; i < l; i++) {
					let a = [], o, s;
					for (let n = 0; n < c; n++) {
						let c = t.getImageLevelInfo(i, n, e);
						e === 0 && i === 0 && n === 0 && (c.origWidth % 4 != 0 || c.origHeight % 4 != 0) && console.warn("THREE.KTX2Loader: ETC1S and UASTC textures should use multiple-of-four dimensions."), l > 1 ? (o = c.origWidth, s = c.origHeight) : (o = c.width, s = c.height);
						let u = new Uint8Array(t.getImageTranscodedSizeInBytes(i, n, 0, h));
						if (!t.transcodeImage(u, i, n, e, h, 0, -1, -1)) throw r(), Error("THREE.KTX2Loader: .transcodeImage failed.");
						a.push(u);
					}
					let u = p(a);
					n.push({
						data: u,
						width: o,
						height: s
					}), v.push(u.buffer);
				}
				_.push({
					mipmaps: n,
					width: o,
					height: s,
					format: g
				});
			}
			return r(), {
				faces: _,
				buffers: v,
				width: o,
				height: s,
				hasAlpha: f,
				format: g,
				dfdFlags: m
			};
		}
		let c = [
			{
				if: "astcSupported",
				basisFormat: [a.UASTC_4x4],
				transcoderFormat: [i.ASTC_4x4, i.ASTC_4x4],
				engineFormat: [r.RGBA_ASTC_4x4_Format, r.RGBA_ASTC_4x4_Format],
				priorityETC1S: Infinity,
				priorityUASTC: 1,
				needsPowerOfTwo: !1
			},
			{
				if: "bptcSupported",
				basisFormat: [a.ETC1S, a.UASTC_4x4],
				transcoderFormat: [i.BC7_M5, i.BC7_M5],
				engineFormat: [r.RGBA_BPTC_Format, r.RGBA_BPTC_Format],
				priorityETC1S: 3,
				priorityUASTC: 2,
				needsPowerOfTwo: !1
			},
			{
				if: "dxtSupported",
				basisFormat: [a.ETC1S, a.UASTC_4x4],
				transcoderFormat: [i.BC1, i.BC3],
				engineFormat: [r.RGB_S3TC_DXT1_Format, r.RGBA_S3TC_DXT5_Format],
				priorityETC1S: 4,
				priorityUASTC: 5,
				needsPowerOfTwo: !1
			},
			{
				if: "etc2Supported",
				basisFormat: [a.ETC1S, a.UASTC_4x4],
				transcoderFormat: [i.ETC1, i.ETC2],
				engineFormat: [r.RGB_ETC2_Format, r.RGBA_ETC2_EAC_Format],
				priorityETC1S: 1,
				priorityUASTC: 3,
				needsPowerOfTwo: !1
			},
			{
				if: "etc1Supported",
				basisFormat: [a.ETC1S, a.UASTC_4x4],
				transcoderFormat: [i.ETC1],
				engineFormat: [r.RGB_ETC1_Format],
				priorityETC1S: 2,
				priorityUASTC: 4,
				needsPowerOfTwo: !1
			},
			{
				if: "pvrtcSupported",
				basisFormat: [a.ETC1S, a.UASTC_4x4],
				transcoderFormat: [i.PVRTC1_4_RGB, i.PVRTC1_4_RGBA],
				engineFormat: [r.RGB_PVRTC_4BPPV1_Format, r.RGBA_PVRTC_4BPPV1_Format],
				priorityETC1S: 5,
				priorityUASTC: 6,
				needsPowerOfTwo: !0
			}
		], l = c.sort(function(e, t) {
			return e.priorityETC1S - t.priorityETC1S;
		}), u = c.sort(function(e, t) {
			return e.priorityUASTC - t.priorityUASTC;
		});
		function d(t, n, o, s) {
			let c, d, p = t === a.ETC1S ? l : u;
			for (let r = 0; r < p.length; r++) {
				let i = p[r];
				if (e[i.if] && i.basisFormat.includes(t) && !(s && i.transcoderFormat.length < 2) && (!i.needsPowerOfTwo || f(n) && f(o))) return c = i.transcoderFormat[+!!s], d = i.engineFormat[+!!s], {
					transcoderFormat: c,
					engineFormat: d
				};
			}
			return console.warn("THREE.KTX2Loader: No suitable compressed texture format found. Decoding to RGBA32."), c = i.RGBA32, d = r.RGBAFormat, {
				transcoderFormat: c,
				engineFormat: d
			};
		}
		function f(e) {
			return e <= 2 || !(e & e - 1) && e !== 0;
		}
		function p(e) {
			if (e.length === 1) return e[0];
			let t = 0;
			for (let n = 0; n < e.length; n++) {
				let r = e[n];
				t += r.byteLength;
			}
			let n = new Uint8Array(t), r = 0;
			for (let t = 0; t < e.length; t++) {
				let i = e[t];
				n.set(i, r), r += i.byteLength;
			}
			return n;
		}
	}), t;
})(), Fe = /* @__PURE__ */ new Set([
	b,
	j,
	M
]), Ie = {
	109: b,
	97: b,
	37: b,
	43: b,
	103: j,
	83: j,
	16: j,
	22: j,
	100: M,
	76: M,
	15: M,
	9: M,
	166: S,
	165: S
}, Le = {
	109: m,
	97: h,
	37: P,
	43: P,
	103: m,
	83: h,
	16: P,
	22: P,
	100: m,
	76: h,
	15: P,
	9: P,
	166: P,
	165: P
};
async function Re(e) {
	let { vkFormat: t } = e;
	if (Ie[t] === void 0) throw Error("THREE.KTX2Loader: Unsupported vkFormat.");
	let n;
	e.supercompressionScheme === 2 && (Ne ||= new Promise(async (e) => {
		let t = new _e();
		await t.init(), e(t);
	}), n = await Ne);
	let r = [];
	for (let i = 0; i < e.levels.length; i++) {
		let a = Math.max(1, e.pixelWidth >> i), o = Math.max(1, e.pixelHeight >> i), s = e.pixelDepth ? Math.max(1, e.pixelDepth >> i) : 0, c = e.levels[i], l;
		if (e.supercompressionScheme === 0) l = c.levelData;
		else if (e.supercompressionScheme === 2) l = n.decode(c.levelData, c.uncompressedByteLength);
		else throw Error("THREE.KTX2Loader: Unsupported supercompressionScheme.");
		let u;
		u = Le[t] === m ? new Float32Array(l.buffer, l.byteOffset, l.byteLength / Float32Array.BYTES_PER_ELEMENT) : Le[t] === h ? new Uint16Array(l.buffer, l.byteOffset, l.byteLength / Uint16Array.BYTES_PER_ELEMENT) : l, r.push({
			data: u,
			width: a,
			height: o,
			depth: s
		});
	}
	let i;
	if (Fe.has(Ie[t])) i = e.pixelDepth === 0 ? new f(r[0].data, e.pixelWidth, e.pixelHeight) : new se(r[0].data, e.pixelWidth, e.pixelHeight, e.pixelDepth);
	else {
		if (e.pixelDepth > 0) throw Error("THREE.KTX2Loader: Unsupported pixelDepth.");
		i = new u(r, e.pixelWidth, e.pixelHeight);
	}
	i.mipmaps = r, i.type = Le[t], i.format = Ie[t], i.needsUpdate = !0;
	let a = ze(e);
	return "colorSpace" in i ? i.colorSpace = a : i.encoding = a === Ae ? Te : we, Promise.resolve(i);
}
function ze(e) {
	let t = e.dataFormatDescriptor[0];
	return t.colorPrimaries === 1 ? t.transferFunction === 2 ? Ae : ke : t.colorPrimaries === 10 ? t.transferFunction === 2 ? De : Oe : (t.colorPrimaries === 0 || console.warn(`THREE.KTX2Loader: Unsupported color primaries, "${t.colorPrimaries}"`), Ee);
}
//#endregion
//#region ../../node_modules/.pnpm/three-stdlib@2.36.1_three@0.185.1/node_modules/three-stdlib/loaders/DRACOLoader.js
var Be = /* @__PURE__ */ new WeakMap(), Ve = class extends v {
	constructor(e) {
		super(e), this.decoderPath = "", this.decoderConfig = {}, this.decoderBinary = null, this.decoderPending = null, this.workerLimit = 4, this.workerPool = [], this.workerNextTaskID = 1, this.workerSourceURL = "", this.defaultAttributeIDs = {
			position: "POSITION",
			normal: "NORMAL",
			color: "COLOR",
			uv: "TEX_COORD"
		}, this.defaultAttributeTypes = {
			position: "Float32Array",
			normal: "Float32Array",
			color: "Float32Array",
			uv: "Float32Array"
		};
	}
	setDecoderPath(e) {
		return this.decoderPath = e, this;
	}
	setDecoderConfig(e) {
		return this.decoderConfig = e, this;
	}
	setWorkerLimit(e) {
		return this.workerLimit = e, this;
	}
	load(e, t, n, r) {
		let i = new p(this.manager);
		i.setPath(this.path), i.setResponseType("arraybuffer"), i.setRequestHeader(this.requestHeader), i.setWithCredentials(this.withCredentials), i.load(e, (e) => {
			let n = {
				attributeIDs: this.defaultAttributeIDs,
				attributeTypes: this.defaultAttributeTypes,
				useUniqueIDs: !1
			};
			this.decodeGeometry(e, n).then(t).catch(r);
		}, n, r);
	}
	decodeDracoFile(e, t, n, r) {
		let i = {
			attributeIDs: n || this.defaultAttributeIDs,
			attributeTypes: r || this.defaultAttributeTypes,
			useUniqueIDs: !!n
		};
		this.decodeGeometry(e, i).then(t);
	}
	decodeGeometry(e, t) {
		for (let e in t.attributeTypes) {
			let n = t.attributeTypes[e];
			n.BYTES_PER_ELEMENT !== void 0 && (t.attributeTypes[e] = n.name);
		}
		let n = JSON.stringify(t);
		if (Be.has(e)) {
			let t = Be.get(e);
			if (t.key === n) return t.promise;
			if (e.byteLength === 0) throw Error("THREE.DRACOLoader: Unable to re-decode a buffer with different settings. Buffer has already been transferred.");
		}
		let r, i = this.workerNextTaskID++, a = e.byteLength, o = this._getWorker(i, a).then((n) => (r = n, new Promise((n, a) => {
			r._callbacks[i] = {
				resolve: n,
				reject: a
			}, r.postMessage({
				type: "decode",
				id: i,
				taskConfig: t,
				buffer: e
			}, [e]);
		}))).then((e) => this._createGeometry(e.geometry));
		return o.catch(() => !0).then(() => {
			r && i && this._releaseTask(r, i);
		}), Be.set(e, {
			key: n,
			promise: o
		}), o;
	}
	_createGeometry(e) {
		let t = new c();
		e.index && t.setIndex(new s(e.index.array, 1));
		for (let n = 0; n < e.attributes.length; n++) {
			let r = e.attributes[n], i = r.name, a = r.array, o = r.itemSize;
			t.setAttribute(i, new s(a, o));
		}
		return t;
	}
	_loadLibrary(e, t) {
		let n = new p(this.manager);
		return n.setPath(this.decoderPath), n.setResponseType(t), n.setWithCredentials(this.withCredentials), new Promise((t, r) => {
			n.load(e, t, void 0, r);
		});
	}
	preload() {
		return this._initDecoder(), this;
	}
	_initDecoder() {
		if (this.decoderPending) return this.decoderPending;
		let e = typeof WebAssembly != "object" || this.decoderConfig.type === "js", t = [];
		return e ? t.push(this._loadLibrary("draco_decoder.js", "text")) : (t.push(this._loadLibrary("draco_wasm_wrapper.js", "text")), t.push(this._loadLibrary("draco_decoder.wasm", "arraybuffer"))), this.decoderPending = Promise.all(t).then((t) => {
			let n = t[0];
			e || (this.decoderConfig.wasmBinary = t[1]);
			let r = He.toString(), i = [
				"/* draco decoder */",
				n,
				"",
				"/* worker */",
				r.substring(r.indexOf("{") + 1, r.lastIndexOf("}"))
			].join("\n");
			this.workerSourceURL = URL.createObjectURL(new Blob([i]));
		}), this.decoderPending;
	}
	_getWorker(e, t) {
		return this._initDecoder().then(() => {
			if (this.workerPool.length < this.workerLimit) {
				let e = new Worker(this.workerSourceURL);
				e._callbacks = {}, e._taskCosts = {}, e._taskLoad = 0, e.postMessage({
					type: "init",
					decoderConfig: this.decoderConfig
				}), e.onmessage = function(t) {
					let n = t.data;
					switch (n.type) {
						case "decode":
							e._callbacks[n.id].resolve(n);
							break;
						case "error":
							e._callbacks[n.id].reject(n);
							break;
						default: console.error("THREE.DRACOLoader: Unexpected message, \"" + n.type + "\"");
					}
				}, this.workerPool.push(e);
			} else this.workerPool.sort(function(e, t) {
				return e._taskLoad > t._taskLoad ? -1 : 1;
			});
			let n = this.workerPool[this.workerPool.length - 1];
			return n._taskCosts[e] = t, n._taskLoad += t, n;
		});
	}
	_releaseTask(e, t) {
		e._taskLoad -= e._taskCosts[t], delete e._callbacks[t], delete e._taskCosts[t];
	}
	debug() {
		console.log("Task load: ", this.workerPool.map((e) => e._taskLoad));
	}
	dispose() {
		for (let e = 0; e < this.workerPool.length; ++e) this.workerPool[e].terminate();
		return this.workerPool.length = 0, this;
	}
};
function He() {
	let e, t;
	onmessage = function(r) {
		let i = r.data;
		switch (i.type) {
			case "init":
				e = i.decoderConfig, t = new Promise(function(t) {
					e.onModuleLoaded = function(e) {
						t({ draco: e });
					}, DracoDecoderModule(e);
				});
				break;
			case "decode":
				let r = i.buffer, a = i.taskConfig;
				t.then((e) => {
					let t = e.draco, o = new t.Decoder(), s = new t.DecoderBuffer();
					s.Init(new Int8Array(r), r.byteLength);
					try {
						let e = n(t, o, s, a), r = e.attributes.map((e) => e.array.buffer);
						e.index && r.push(e.index.array.buffer), self.postMessage({
							type: "decode",
							id: i.id,
							geometry: e
						}, r);
					} catch (e) {
						console.error(e), self.postMessage({
							type: "error",
							id: i.id,
							error: e.message
						});
					} finally {
						t.destroy(s), t.destroy(o);
					}
				});
		}
	};
	function n(e, t, n, a) {
		let o = a.attributeIDs, s = a.attributeTypes, c, l, u = t.GetEncodedGeometryType(n);
		if (u === e.TRIANGULAR_MESH) c = new e.Mesh(), l = t.DecodeBufferToMesh(n, c);
		else if (u === e.POINT_CLOUD) c = new e.PointCloud(), l = t.DecodeBufferToPointCloud(n, c);
		else throw Error("THREE.DRACOLoader: Unexpected geometry type.");
		if (!l.ok() || c.ptr === 0) throw Error("THREE.DRACOLoader: Decoding failed: " + l.error_msg());
		let d = {
			index: null,
			attributes: []
		};
		for (let n in o) {
			let r = self[s[n]], l, u;
			if (a.useUniqueIDs) u = o[n], l = t.GetAttributeByUniqueId(c, u);
			else {
				if (u = t.GetAttributeId(c, e[o[n]]), u === -1) continue;
				l = t.GetAttribute(c, u);
			}
			d.attributes.push(i(e, t, c, n, r, l));
		}
		return u === e.TRIANGULAR_MESH && (d.index = r(e, t, c)), e.destroy(c), d;
	}
	function r(e, t, n) {
		let r = n.num_faces() * 3, i = r * 4, a = e._malloc(i);
		t.GetTrianglesUInt32Array(n, i, a);
		let o = new Uint32Array(e.HEAPF32.buffer, a, r).slice();
		return e._free(a), {
			array: o,
			itemSize: 1
		};
	}
	function i(e, t, n, r, i, o) {
		let s = o.num_components(), c = n.num_points() * s, l = c * i.BYTES_PER_ELEMENT, u = a(e, i), d = e._malloc(l);
		t.GetAttributeDataArrayForAllPoints(n, o, u, l, d);
		let f = new i(e.HEAPF32.buffer, d, c).slice();
		return e._free(d), {
			name: r,
			array: f,
			itemSize: s
		};
	}
	function a(e, t) {
		switch (t) {
			case Float32Array: return e.DT_FLOAT32;
			case Int8Array: return e.DT_INT8;
			case Int16Array: return e.DT_INT16;
			case Int32Array: return e.DT_INT32;
			case Uint8Array: return e.DT_UINT8;
			case Uint16Array: return e.DT_UINT16;
			case Uint32Array: return e.DT_UINT32;
		}
	}
}
var Ue = {
	note: "Generated by scripts/import-kit.mjs. Every entry is CC0 1.0, except rows whose licence names the Owner's own arrangement with the donor.",
	donor: "world-of-claudecraft",
	assets: {
		"tree-broad-a": {
			src: "/kit/tree-broad-a.glb",
			bytes: 393512,
			sha256: "9510f3ba02e6395e",
			from: "models/foliage/oak_1.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"tree-broad-b": {
			src: "/kit/tree-broad-b.glb",
			bytes: 361100,
			sha256: "f5c66922b92e5fc5",
			from: "models/foliage/oak_3.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"tree-tall-a": {
			src: "/kit/tree-tall-a.glb",
			bytes: 331332,
			sha256: "18d21cee2d4141a3",
			from: "models/foliage/pine_1.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"tree-tall-b": {
			src: "/kit/tree-tall-b.glb",
			bytes: 376164,
			sha256: "e5a0c2c9f70804cc",
			from: "models/foliage/pine_3.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		bush: {
			src: "/kit/bush.glb",
			bytes: 49364,
			sha256: "fa2a801672329cc1",
			from: "models/foliage/bush.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"bush-flowering": {
			src: "/kit/bush-flowering.glb",
			bytes: 101296,
			sha256: "fa3638eafbc0cfb7",
			from: "models/foliage/bush_flowers.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		fern: {
			src: "/kit/fern.glb",
			bytes: 62500,
			sha256: "33e9046ba9786f0a",
			from: "models/foliage/fern.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		mushroom: {
			src: "/kit/mushroom.glb",
			bytes: 58676,
			sha256: "99c98498e0f1711d",
			from: "models/foliage/mushroom.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"rock-a": {
			src: "/kit/rock-a.glb",
			bytes: 54048,
			sha256: "9d07cf3ea59929a2",
			from: "models/foliage/rock_1.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"rock-b": {
			src: "/kit/rock-b.glb",
			bytes: 52852,
			sha256: "29dc43a75cb937a3",
			from: "models/foliage/rock_2.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"rock-c": {
			src: "/kit/rock-c.glb",
			bytes: 56280,
			sha256: "6d9f88abfa9af2eb",
			from: "models/foliage/rock_3.glb",
			pack: "Stylized Nature MegaKit",
			author: "Quaternius",
			source: "https://quaternius.itch.io/stylized-nature-megakit",
			license: "CC0 1.0"
		},
		"house-small": {
			src: "/kit/house-small.glb",
			bytes: 43696,
			sha256: "3b426a1d8894d342",
			from: "models/props/house_3.glb",
			pack: "Medieval Village Pack / Fantasy Props MegaKit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/medievalvillage.html",
			license: "CC0 1.0"
		},
		"house-mid": {
			src: "/kit/house-mid.glb",
			bytes: 84484,
			sha256: "87c8306f95e335ce",
			from: "models/props/house_1.glb",
			pack: "Medieval Village Pack / Fantasy Props MegaKit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/medievalvillage.html",
			license: "CC0 1.0"
		},
		"house-large": {
			src: "/kit/house-large.glb",
			bytes: 103180,
			sha256: "ede3299a2b09bdf6",
			from: "models/props/house_2.glb",
			pack: "Medieval Village Pack / Fantasy Props MegaKit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/medievalvillage.html",
			license: "CC0 1.0"
		},
		hall: {
			src: "/kit/hall.glb",
			bytes: 92748,
			sha256: "a1386fe4db504f51",
			from: "models/props/inn.glb",
			pack: "Medieval Village Pack / Fantasy Props MegaKit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/medievalvillage.html",
			license: "CC0 1.0"
		},
		well: {
			src: "/kit/well.glb",
			bytes: 27788,
			sha256: "9308ba09ea3bed04",
			from: "models/props/well.glb",
			pack: "Medieval Village Pack / Fantasy Props MegaKit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/medievalvillage.html",
			license: "CC0 1.0"
		},
		beacon: {
			src: "/kit/beacon.glb",
			bytes: 13284,
			sha256: "3e5f78d3d6dbd24e",
			from: "models/props/bonfire.glb",
			pack: "Medieval Village Pack / Fantasy Props MegaKit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/medievalvillage.html",
			license: "CC0 1.0"
		},
		dock: {
			src: "/kit/dock.glb",
			bytes: 23012,
			sha256: "f638d6f160b48915",
			from: "models/biome/beach_dock.glb",
			pack: "Pirate Kit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/piratekit.html",
			license: "CC0 1.0"
		},
		palm: {
			src: "/kit/palm.glb",
			bytes: 29996,
			sha256: "3708458ac66335c9",
			from: "models/biome/beach_palm_1.glb",
			pack: "Pirate Kit",
			author: "Quaternius",
			source: "https://quaternius.com/packs/piratekit.html",
			license: "CC0 1.0"
		},
		learner: {
			src: "/kit/learner.glb",
			bytes: 448736,
			sha256: "876d60366dc2105a",
			from: "models/chars/players/rogue_hooded.glb",
			pack: "KayKit Character Pack: Adventurers",
			author: "Kay Lousberg (KayKit)",
			source: "https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0",
			license: "CC0 1.0"
		},
		"monster-frog": {
			src: "/kit/monster-frog.glb",
			bytes: 140836,
			sha256: "0d77a9e6b9a741bc",
			from: "models/creatures/frog.glb",
			pack: "Quaternius animated creatures",
			author: "Quaternius",
			source: "https://poly.pizza/u/Quaternius · https://quaternius.com",
			license: "CC0 1.0"
		},
		"monster-crab": {
			src: "/kit/monster-crab.glb",
			bytes: 62156,
			sha256: "8d3c9c7a231c9835",
			from: "models/creatures/crabenemy.glb",
			pack: "Quaternius animated creatures",
			author: "Quaternius",
			source: "https://poly.pizza/u/Quaternius · https://quaternius.com",
			license: "CC0 1.0"
		},
		"monster-yeti": {
			src: "/kit/monster-yeti.glb",
			bytes: 41144,
			sha256: "acbf79f899d21a5e",
			from: "models/creatures/yeti.glb",
			pack: "Quaternius animated creatures",
			author: "Quaternius",
			source: "https://poly.pizza/u/Quaternius · https://quaternius.com",
			license: "CC0 1.0"
		},
		"monster-boar": {
			src: "/kit/monster-boar.glb",
			bytes: 318604,
			sha256: "de4e128ddd963b58",
			from: "models/creatures/wild_boar.glb",
			pack: "World of ClaudeCraft creatures",
			author: "Levy Street (World of ClaudeCraft)",
			source: "https://github.com/levy-street/world-of-claudecraft",
			license: "Owner-arranged permission, 2026-09-27"
		},
		"monster-mushroom": {
			src: "/kit/monster-mushroom.glb",
			bytes: 1302976,
			sha256: "8186e2c99bf3c6da",
			from: "models/creatures/mushroom_pixie.glb",
			pack: "World of ClaudeCraft creatures",
			author: "Levy Street (World of ClaudeCraft)",
			source: "https://github.com/levy-street/world-of-claudecraft",
			license: "Owner-arranged permission, 2026-09-27"
		},
		"monster-chicken": {
			src: "/kit/monster-chicken.glb",
			bytes: 209536,
			sha256: "b1235f3a04bf5ab7",
			from: "models/creatures/chicken_cow.glb",
			pack: "World of ClaudeCraft creatures",
			author: "Levy Street (World of ClaudeCraft)",
			source: "https://github.com/levy-street/world-of-claudecraft",
			license: "Owner-arranged permission, 2026-09-27"
		},
		"monster-boss": {
			src: "/kit/monster-boss.glb",
			bytes: 85588,
			sha256: "156f4c2dcf93c6e5",
			from: "models/creatures/golelingevolved.glb",
			pack: "Quaternius animated creatures",
			author: "Quaternius",
			source: "https://poly.pizza/u/Quaternius · https://quaternius.com",
			license: "CC0 1.0"
		},
		wisp: {
			src: "/kit/wisp.glb",
			bytes: 162784,
			sha256: "25010f4fcd2a0aba",
			from: "models/creatures/glimmerwisp.glb",
			pack: "World of ClaudeCraft creatures",
			author: "Levy Street (World of ClaudeCraft)",
			source: "https://github.com/levy-street/world-of-claudecraft",
			license: "Owner-arranged permission, 2026-09-27"
		}
	}
};
//#endregion
//#region src/kit-resources.ts
function We(e) {
	let t = e.clone();
	return t.userData = { ...e.userData }, t;
}
function Ge(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let r of e) t.add(r.geometry), n.add(r.material);
	for (let e of t) e.dispose();
	for (let e of n) e.dispose();
}
//#endregion
//#region src/island/random.ts
function L(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n += 1) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0) / 4294967296;
}
function R(e) {
	let t = 0;
	return () => L(`${e}#${t += 1}`);
}
//#endregion
//#region ../../node_modules/.pnpm/react@19.2.8/node_modules/react/cjs/react-jsx-runtime.production.js
var Ke = /* @__PURE__ */ ne(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.Fragment = n, e.jsx = r, e.jsxs = r;
})), qe = /* @__PURE__ */ ne(((e) => {
	process.env.NODE_ENV !== "production" && (function() {
		function t(e) {
			if (e == null) return null;
			if (typeof e == "function") return e.$$typeof === O ? null : e.displayName || e.name || null;
			if (typeof e == "string") return e;
			switch (e) {
				case _: return "Fragment";
				case y: return "Profiler";
				case v: return "StrictMode";
				case C: return "Suspense";
				case w: return "SuspenseList";
				case D: return "Activity";
			}
			if (typeof e == "object") switch (typeof e.tag == "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), e.$$typeof) {
				case g: return "Portal";
				case x: return e.displayName || "Context";
				case b: return (e._context.displayName || "Context") + ".Consumer";
				case S:
					var n = e.render;
					return e = e.displayName, e ||= (e = n.displayName || n.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
				case T: return n = e.displayName || null, n === null ? t(e.type) || "Memo" : n;
				case E:
					n = e._payload, e = e._init;
					try {
						return t(e(n));
					} catch {}
			}
			return null;
		}
		function n(e) {
			return "" + e;
		}
		function r(e) {
			try {
				n(e);
				var t = !1;
			} catch {
				t = !0;
			}
			if (t) {
				t = console;
				var r = t.error, i = typeof Symbol == "function" && Symbol.toStringTag && e[Symbol.toStringTag] || e.constructor.name || "Object";
				return r.call(t, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", i), n(e);
			}
		}
		function i(e) {
			if (e === _) return "<>";
			if (typeof e == "object" && e && e.$$typeof === E) return "<...>";
			try {
				var n = t(e);
				return n ? "<" + n + ">" : "<...>";
			} catch {
				return "<...>";
			}
		}
		function a() {
			var e = k.A;
			return e === null ? null : e.getOwner();
		}
		function o() {
			return Error("react-stack-top-frame");
		}
		function s(e) {
			if (A.call(e, "key")) {
				var t = Object.getOwnPropertyDescriptor(e, "key").get;
				if (t && t.isReactWarning) return !1;
			}
			return e.key !== void 0;
		}
		function c(e, t) {
			function n() {
				N || (N = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", t));
			}
			n.isReactWarning = !0, Object.defineProperty(e, "key", {
				get: n,
				configurable: !0
			});
		}
		function l() {
			var e = t(this.type);
			return P[e] || (P[e] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release.")), e = this.props.ref, e === void 0 ? null : e;
		}
		function u(e, t, n, r, i, a) {
			var o = n.ref;
			return e = {
				$$typeof: h,
				type: e,
				key: t,
				props: n,
				_owner: r
			}, (o === void 0 ? null : o) === null ? Object.defineProperty(e, "ref", {
				enumerable: !1,
				value: null
			}) : Object.defineProperty(e, "ref", {
				enumerable: !1,
				get: l
			}), e._store = {}, Object.defineProperty(e._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			}), Object.defineProperty(e, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			}), Object.defineProperty(e, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: i
			}), Object.defineProperty(e, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: a
			}), Object.freeze && (Object.freeze(e.props), Object.freeze(e)), e;
		}
		function d(e, n, i, o, l, d) {
			var p = n.children;
			if (p !== void 0) {
				if (o) {
					if (j(p)) {
						for (o = 0; o < p.length; o++) f(p[o]);
						Object.freeze && Object.freeze(p);
					} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
				} else f(p);
			}
			if (A.call(n, "key")) {
				p = t(e);
				var m = Object.keys(n).filter(function(e) {
					return e !== "key";
				});
				o = 0 < m.length ? "{key: someKey, " + m.join(": ..., ") + ": ...}" : "{key: someKey}", te[p + o] || (m = 0 < m.length ? "{" + m.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", o, p, m, p), te[p + o] = !0);
			}
			if (p = null, i !== void 0 && (r(i), p = "" + i), s(n) && (r(n.key), p = "" + n.key), "key" in n) for (var h in i = {}, n) h !== "key" && (i[h] = n[h]);
			else i = n;
			return p && c(i, typeof e == "function" ? e.displayName || e.name || "Unknown" : e), u(e, p, i, a(), l, d);
		}
		function f(e) {
			p(e) ? e._store && (e._store.validated = 1) : typeof e == "object" && e && e.$$typeof === E && (e._payload.status === "fulfilled" ? p(e._payload.value) && e._payload.value._store && (e._payload.value._store.validated = 1) : e._store && (e._store.validated = 1));
		}
		function p(e) {
			return typeof e == "object" && !!e && e.$$typeof === h;
		}
		var m = re("react"), h = Symbol.for("react.transitional.element"), g = Symbol.for("react.portal"), _ = Symbol.for("react.fragment"), v = Symbol.for("react.strict_mode"), y = Symbol.for("react.profiler"), b = Symbol.for("react.consumer"), x = Symbol.for("react.context"), S = Symbol.for("react.forward_ref"), C = Symbol.for("react.suspense"), w = Symbol.for("react.suspense_list"), T = Symbol.for("react.memo"), E = Symbol.for("react.lazy"), D = Symbol.for("react.activity"), O = Symbol.for("react.client.reference"), k = m.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, A = Object.prototype.hasOwnProperty, j = Array.isArray, M = console.createTask ? console.createTask : function() {
			return null;
		};
		m = { react_stack_bottom_frame: function(e) {
			return e();
		} };
		var N, P = {}, F = m.react_stack_bottom_frame.bind(m, o)(), ee = M(i(o)), te = {};
		e.Fragment = _, e.jsx = function(e, t, n) {
			var r = 1e4 > k.recentlyCreatedOwnerStacks++;
			return d(e, t, n, !1, r ? Error("react-stack-top-frame") : F, r ? M(i(e)) : ee);
		}, e.jsxs = function(e, t, n) {
			var r = 1e4 > k.recentlyCreatedOwnerStacks++;
			return d(e, t, n, !0, r ? Error("react-stack-top-frame") : F, r ? M(i(e)) : ee);
		};
	})();
})), z = (/* @__PURE__ */ ne(((e, t) => {
	t.exports = process.env.NODE_ENV === "production" ? Ke() : qe();
})))();
Ue.assets;
function Je(e) {
	let t = e.attributes.color;
	if (!t || e.userData.lifted) return;
	let n = .55, r = new Float32Array(t.count * 3);
	for (let e = 0; e < t.count; e += 1) r[e * 3] = n + .44999999999999996 * t.getX(e), r[e * 3 + 1] = n + .44999999999999996 * t.getY(e), r[e * 3 + 2] = n + .44999999999999996 * t.getZ(e);
	e.setAttribute("color", new o.BufferAttribute(r, 3)), e.userData.lifted = !0;
}
var Ye = [
	[/leaf|leaves|foliage|canopy|bush|fern|grass/i, 6266438],
	[/pine|conifer|spruce|fir/i, 4422218],
	[/bark|trunk|branch|log|wood/i, 8018492],
	[/rock|stone|cliff|boulder|gravel/i, 9210496],
	[/sand|dirt|soil|ground|earth/i, 12559991],
	[/roof|tile|shingle/i, 10771271],
	[/wall|plaster|stucco|straw|thatch/i, 14075556],
	[/mushroom|flower|petal|bloom/i, 13660511],
	[/fire|flame|ember|lamp|light|torch|lantern/i, 16757575],
	[/water|sea|wave/i, 3115424],
	[/metal|iron|steel|nail/i, 9409692]
];
function Xe(e, t = !1) {
	let n = e;
	if (t) {
		let t = e.clone();
		return t instanceof o.MeshStandardMaterial && (t.flatShading = !0, t.roughness = Math.max(.72, t.roughness), t.side = o.DoubleSide, t.needsUpdate = !0), t;
	}
	let r = Ye.find(([e]) => e.test(n.name ?? "")), i = new o.MeshStandardMaterial({
		color: r ? r[1] : n.color?.getHex() ?? 16777215,
		vertexColors: n.vertexColors,
		flatShading: !0,
		roughness: .92,
		metalness: 0,
		side: o.DoubleSide
	});
	return i.name = n.name, i;
}
var Ze = null, Qe = new Ve().setDecoderPath("/draco/");
function $e() {
	let e = te((e) => e.gl);
	return n(() => (Ze ??= new Pe().setTranscoderPath("/basis/"), Ze.detectSupport(e)), [e]);
}
function et(e) {
	let t = $e();
	return F(e, !1, !0, (e) => {
		e.setDRACOLoader(Qe), e.setKTX2Loader(t);
	});
}
var tt = [];
function nt(e = .86) {
	let t = new o.MeshStandardMaterial({
		color: 16777215,
		vertexColors: !0,
		roughness: e,
		metalness: 0,
		flatShading: !0,
		side: o.DoubleSide
	});
	return t.onBeforeCompile = (e) => {
		e.fragmentShader = e.fragmentShader.replace("#include <opaque_fragment>", [
			"float propEdge = smoothstep(0.02, 0.72, abs(normal.y));",
			"outgoingLight *= mix(0.88, 1.0, propEdge);",
			"outgoingLight = max(outgoingLight, diffuseColor.rgb * 0.32);",
			"#include <opaque_fragment>"
		].join("\n"));
	}, t.customProgramCacheKey = () => "hex-grid-batched-prop-v2", t;
}
function rt(e, t) {
	e.updateMatrixWorld(!0);
	let n = new o.Box3().setFromObject(e), r = n.getSize(new o.Vector3()), i = n.getCenter(new o.Vector3()), a = r.y || 1, s = new o.Matrix4().makeScale(1 / a, 1 / a, 1 / a).multiply(new o.Matrix4().makeTranslation(-i.x, -n.min.y, -i.z)), c = [];
	return e.traverse((e) => {
		let n = e;
		if (!n.isMesh) return;
		let r = Array.isArray(n.material) ? n.material[0] : n.material;
		r && c.push({
			sourceGeometry: n.geometry,
			sourceMaterial: r,
			preserveMap: t,
			offset: new o.Matrix4().multiplyMatrices(s, n.matrixWorld)
		});
	}), c;
}
function it(e, t = !1) {
	let r = et(e);
	return n(() => rt(r.scene, t), [r, t]);
}
function at(e) {
	let t = $e(), r = e.length > 0 ? e : tt, i = F(r, !1, !0, (e) => {
		e.setDRACOLoader(Qe), e.setKTX2Loader(t);
	});
	return n(() => {
		let t = /* @__PURE__ */ new Map();
		if (e.length === 0) return t;
		let n = Array.isArray(i) ? i : [i];
		return e.forEach((e, r) => {
			let i = n[r]?.scene;
			i && t.set(e, rt(i, !1));
		}), t;
	}, [i, e]);
}
function ot({ src: e, at: t, preserveMap: n = !0, castShadow: r = !0, materialTreatment: i }) {
	let a = it(e, n);
	return /* @__PURE__ */ (0, z.jsx)(z.Fragment, { children: a.map((n, a) => /* @__PURE__ */ (0, z.jsx)(_t, {
		part: n,
		at: t,
		castShadow: r,
		materialTreatment: i
	}, `${e}-${a}`)) });
}
var st = [
	[/fall|autumn/, 14256182],
	[/birch/, 14273972],
	[/mushroom|colorred|red/, 14706250],
	[/corn|wheat/, 14726482],
	[/flower|yellow/, 15777103],
	[/purple|violet/, 10514112],
	[/grass|leaf|plant|foliage/, 7315004],
	[/bark|wood|trunk|log/, 9398853],
	[/stone|rock|dirt|sand/, 10257511]
];
function ct(e) {
	let t = (e.name ?? "").toLowerCase(), n = st.find(([e]) => e.test(t)), r = new o.Color(n ? n[1] : e.color?.getHex?.() ?? 13811607);
	return /dark/.test(t) ? r.multiplyScalar(.74) : /inner|light/.test(t) && r.multiplyScalar(1.15), r;
}
function lt(e) {
	let t = (e.name ?? "").toLowerCase();
	return /grass|leaf|plant|foliage/.test(t);
}
function ut(e, t) {
	return t === "material" ? e.sourceMaterial.color?.clone?.() ?? new o.Color(16777215) : ct(e.sourceMaterial);
}
function dt(e, t, n, r) {
	let i = new Float32Array(e * 3);
	if (t) {
		if (t.count !== e || t.itemSize < 3) throw Error("A batched prop color attribute must have one RGB value per position");
		for (let a = 0; a < e; a += 1) r ? (i[a * 3] = t.getX(a) * n.r, i[a * 3 + 1] = t.getY(a) * n.g, i[a * 3 + 2] = t.getZ(a) * n.b) : (i[a * 3] = t.getX(a), i[a * 3 + 1] = t.getY(a), i[a * 3 + 2] = t.getZ(a));
		return i;
	}
	for (let t = 0; t < e; t += 1) n.toArray(i, t * 3);
	return i;
}
function ft(e, t, n) {
	if (!lt(e)) return null;
	let r = `grid-foliage/${e.name}/${n}/${Math.round(t.position.x * 10)},${Math.round(t.position.z * 10)}`, i = .84 + L(r) * .32, a = (L(`${r}/tilt`) - .5) * .16;
	return new o.Color(i * (1 + a), i, i * (1 - a * .6));
}
function pt(e, t = "family") {
	let n = We(e.sourceGeometry);
	for (let e of Object.keys(n.attributes)) e !== "position" && e !== "normal" && e !== "color" && n.deleteAttribute(e);
	let r = n.getAttribute("position");
	if (!r) throw Error("A batched prop part needs a position attribute");
	n.getAttribute("normal") || n.computeVertexNormals();
	let i = n.getAttribute("color"), a = dt(r.count, i, ut(e, t), t === "material");
	return n.setAttribute("color", new o.BufferAttribute(a, 3)), n;
}
function mt(e) {
	return [...new Set(e.map((e) => e.src))].sort().join("\0");
}
function ht(e, t, n, r, i) {
	let a = `${n}|${t}|${+!!r}|${i}`;
	for (let t of e) {
		a += `|${t.src}|${t.at.length}`;
		for (let e of t.at) {
			let t = e.width ?? "";
			a += `@${e.position.x},${e.position.y},${e.position.z},${e.height},${e.turn},${t}`;
		}
	}
	return a;
}
function gt({ fields: e, castShadow: a = !1, name: s = "hex-grid-batched-library", colorSource: c = "family", roughness: l = .86 }) {
	let u = mt(e), d = at(n(() => u === "" ? [] : u.split("\0"), [u])), [f, p] = i(null), m = r(e);
	m.current = e;
	let h = ht(e, c, s, a, l);
	return t(() => {
		let e = m.current.filter((e) => e.at.length > 0);
		if (e.length === 0 || d.size === 0) return;
		let t = /* @__PURE__ */ new Map(), n = 0, r = 0, i = 0;
		for (let a of e) {
			let e = d.get(a.src);
			if (e && e.length !== 0) {
				if (!t.has(a.src)) {
					let i = e.map((e) => pt(e, c));
					t.set(a.src, i);
					for (let e of i) n += e.getAttribute("position").count, r += e.index?.count ?? 0;
				}
				i += a.at.length * e.length;
			}
		}
		if (i === 0) return;
		let u = nt(l), f = new o.BatchedMesh(i, Math.max(1, n), Math.max(1, r), u);
		f.perObjectFrustumCulled = !1, f.sortObjects = !1, f.castShadow = a, f.frustumCulled = !1, f.name = s;
		let h = /* @__PURE__ */ new Map();
		for (let [e, n] of t) h.set(e, n.map((e) => f.addGeometry(e)));
		let g = new o.Matrix4(), _ = new o.Matrix4(), v = 0;
		for (let t of e) {
			let e = d.get(t.src), n = h.get(t.src);
			e && n && t.at.forEach((t, r) => {
				let i = t.width ?? t.height;
				_.compose(t.position, new o.Quaternion().setFromAxisAngle(new o.Vector3(0, 1, 0), t.turn), new o.Vector3(i, t.height, i)), n.forEach((n, i) => {
					let a = f.addInstance(n);
					if (f.setMatrixAt(a, g.multiplyMatrices(_, e[i].offset)), c === "family") {
						let n = ft(e[i].sourceMaterial, t, r);
						n && f.setColorAt(a, n);
					}
				}), v += 1;
			});
		}
		f.userData = {
			islandLookPlacementCount: v,
			islandLookBatch: !0,
			islandLookMaterials: [...d.entries()].flatMap(([e, t]) => t.map((t) => `${e.split("/").pop()}::${t.sourceMaterial.name}::${ut(t, c).getHexString()}`))
		}, f.computeBoundingBox(), f.computeBoundingSphere();
		for (let e of t.values()) e.forEach((e) => e.dispose());
		return p(f), () => {
			p((e) => e === f ? null : e), f.dispose(), u.dispose();
		};
	}, [
		a,
		c,
		h,
		s,
		d,
		l
	]), f ? /* @__PURE__ */ (0, z.jsx)("primitive", {
		object: f,
		dispose: null
	}) : null;
}
function _t({ part: e, at: n, castShadow: a = !0, materialTreatment: s }) {
	let c = r(null), l = r(null), [u, d] = i(null);
	return t(() => {
		let t = We(e.sourceGeometry);
		e.preserveMap || Je(t);
		let n = {
			geometry: t,
			material: Xe(e.sourceMaterial, e.preserveMap)
		};
		try {
			s?.(n.material, e.offset);
		} catch (e) {
			throw Ge([n]), e;
		}
		return l.current = n, d(n), () => {
			l.current === n && (l.current = null), Ge([n]);
		};
	}, [e, s]), t(() => {
		let t = c.current;
		if (!t) return;
		let r = new o.Matrix4(), i = new o.Matrix4();
		n.forEach((n, a) => {
			let s = n.width ?? n.height;
			i.compose(n.position, new o.Quaternion().setFromAxisAngle(new o.Vector3(0, 1, 0), n.turn), new o.Vector3(s, n.height, s)), t.setMatrixAt(a, r.multiplyMatrices(i, e.offset));
		}), t.instanceMatrix.needsUpdate = !0, t.computeBoundingSphere();
	}, [
		n,
		u,
		e
	]), u ? /* @__PURE__ */ (0, z.jsx)("instancedMesh", {
		ref: c,
		args: [
			u.geometry,
			u.material,
			Math.max(n.length, 1)
		],
		userData: { islandLookPlacementCount: n.length },
		castShadow: a,
		frustumCulled: !1
	}, n.length) : null;
}
var vt = {
	schemaVersion: 1,
	assetSet: "elemental-serenity",
	status: "author permission granted 2026-08-28; usable as product media",
	sourceRoot: "local-donor:Elemental-Serenity",
	sourceRootHint: "local donor checkout; ELEMENTAL_SERENITY_DONOR_ROOT",
	outputRoot: "public/models/elemental-serenity",
	runtimeBasePath: "/models/elemental-serenity",
	licenseStatus: "author-permission-granted",
	registeredOn: "2026-08-28",
	whitelistPolicy: "explicit filenames only; no donor glob",
	dependencies: [],
	assets: [
		{
			type: "model",
			id: "elemental-serenity-bridge",
			assetId: "bridge",
			src: "/models/elemental-serenity/bridge.glb",
			bytes: 66540,
			sha256: "0bcea5872b72836a51913a8974d840891aa3e78e1717053d420a5cc0d664e769",
			source: "Elemental-Serenity/public/models/bridge.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 0,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["outpost", "bridge"]
		},
		{
			type: "model",
			id: "elemental-serenity-bushEmitter",
			assetId: "bushEmitter",
			src: "/models/elemental-serenity/bushEmitter.glb",
			bytes: 2292,
			sha256: "7d46e74651b71bf65aed81bf22f119278b30baf700f36c9bd348c79c6be24690",
			source: "Elemental-Serenity/public/models/bushEmitter.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 0,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["outpost", "bush"]
		},
		{
			type: "model",
			id: "elemental-serenity-camp",
			assetId: "camp",
			src: "/models/elemental-serenity/camp.glb",
			bytes: 36048,
			sha256: "a24d3fc2bc55463009a0b2da4af8fcd39818bb4d53a3d417d955348f7cc1cb03",
			source: "Elemental-Serenity/public/models/camp.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 0,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["outpost", "camp"]
		},
		{
			type: "model",
			id: "elemental-serenity-grass_blade",
			assetId: "grass_blade",
			src: "/models/elemental-serenity/grass_blade.glb",
			bytes: 1212,
			sha256: "8335033073db9a9ad7ae936b219c878a833a37b343408e630af5693b53c5e72f",
			source: "Elemental-Serenity/public/models/grass_blade.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 0,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["grass", "future-use"]
		},
		{
			type: "model",
			id: "elemental-serenity-leaf",
			assetId: "leaf",
			src: "/models/elemental-serenity/leaf.glb",
			bytes: 1192,
			sha256: "3aa6d1f133473b8f1c315043fa99f1ef17806b412a458e55869b5514426c2327",
			source: "Elemental-Serenity/public/models/leaf.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 0,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["foliage", "future-use"]
		},
		{
			type: "model",
			id: "elemental-serenity-rocks",
			assetId: "rocks",
			src: "/models/elemental-serenity/rocks.glb",
			bytes: 67004,
			sha256: "f70adf99656be67693be449e17847979db1eb49c99fd4addfd263f4e55b94767",
			source: "Elemental-Serenity/public/models/rocks.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 0,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["outpost", "stone-ring"]
		},
		{
			type: "model",
			id: "elemental-serenity-tent",
			assetId: "tent",
			src: "/models/elemental-serenity/tent.glb",
			bytes: 71360,
			sha256: "b3bf77f44f27c8223d061d59f61280488a4cc7934e3f41a90ae23fba792eefbe",
			source: "Elemental-Serenity/public/models/tent.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 0,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["outpost", "camp"]
		},
		{
			type: "model",
			id: "elemental-serenity-treeTrunks",
			assetId: "treeTrunks",
			src: "/models/elemental-serenity/treeTrunks.glb",
			bytes: 15352,
			sha256: "e7067a0faefefbe3cc500e7d02f5855570bdd98f9b29f424752e8bf9319c1767",
			source: "Elemental-Serenity/public/models/treeTrunks.glb",
			pack: "elemental-serenity",
			dependencies: [],
			embeddedImageCount: 1,
			provenance: "author-permission-granted",
			registeredOn: "2026-08-28",
			roles: ["outpost", "tree-trunks"]
		}
	],
	summary: {
		modelCount: 8,
		dependencyCount: 0,
		totalBytes: 261e3,
		externalTextureCount: 0,
		embeddedImageCount: 1
	},
	licenseGrantedOn: "2026-08-28",
	licenseNote: "Author permission for the Elemental-Serenity media was granted by the product owner on 2026-08-28. The portfolio-shared row in docs/policy/shared-rules/donors.md still reads \"来源待确认\" and must be updated upstream in ProjectGovernanceSystem, not only here."
}, yt = {
	schemaVersion: 1,
	assetSet: "R01-forest-academy",
	status: "prototype/local donor; PGS donor registered",
	sourceRoot: "local-donor:Kenney",
	sourceRootHint: "../../../_Donors/Kenney or KENNEY_DONOR_ROOT",
	outputRoot: "public/kenney/r01",
	runtimeBasePath: "/kenney/r01",
	selection: {
		naturalBasePackId: "nature-kit",
		accentPackIds: ["fantasy-town-kit"],
		physicalAccentCount: 1,
		rawGlbBudget: 12,
		whitelistPolicy: "explicit filenames only; no donor glob"
	},
	runtimeFallbacks: {
		"fantasy-town-kit/watermill": {
			pack: "fantasy-town-kit",
			assetId: "fountain-round",
			reason: "The recipe catalog entry is not present in the checked-in Fantasy Town runtime whitelist."
		},
		"watercraft-pack/boat-house-a": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"watercraft-pack/boat-row-small": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"watercraft-pack/buoy": {
			pack: "fantasy-town-kit",
			assetId: "fountain-round",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"watercraft-pack/cargo-container-a": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-space-kit/gate": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-space-kit/corridor-intersection": {
			pack: "fantasy-town-kit",
			assetId: "wall-corner",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-space-kit/platform-large": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-kit/satelliteDish_large": {
			pack: "fantasy-town-kit",
			assetId: "roof",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-kit/machine_generatorLarge": {
			pack: "fantasy-town-kit",
			assetId: "fountain-round",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-kit/rover": {
			pack: "fantasy-town-kit",
			assetId: "stall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-station-kit/wall": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-station-kit/floor": {
			pack: "fantasy-town-kit",
			assetId: "roof",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-station-kit/pipe": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-space-kit/room": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-space-kit/corridor": {
			pack: "fantasy-town-kit",
			assetId: "wall-corner",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-space-kit/gate-lasers": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"tower-defense-kit/tower": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"tower-defense-kit/detail-crystal": {
			pack: "fantasy-town-kit",
			assetId: "fountain-round",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-kit/enemy-ufo-a": {
			pack: "fantasy-town-kit",
			assetId: "roof",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"space-kit/enemy-ufo-b": {
			pack: "fantasy-town-kit",
			assetId: "roof-gable",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"castle-kit/wall": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"castle-kit/tower": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"castle-kit/gate": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-forest/bridge": {
			pack: "fantasy-town-kit",
			assetId: "wall-corner",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-forest/tent": {
			pack: "fantasy-town-kit",
			assetId: "stall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-forest/character-archer": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The recipe accent slot is runtime-visible, but this character asset is not shipped in the current whitelist."
		},
		"mini-arena/floor": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-arena/wall": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-arena/statue": {
			pack: "fantasy-town-kit",
			assetId: "fountain-round",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"platformer-kit/platform": {
			pack: "fantasy-town-kit",
			assetId: "roof",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"platformer-kit/marker": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-dungeon-kit/room": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-dungeon-kit/corridor": {
			pack: "fantasy-town-kit",
			assetId: "wall-corner",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-dungeon-kit/door": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-dungeon/torch": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-dungeon/chest": {
			pack: "fantasy-town-kit",
			assetId: "stall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-dungeon/character-human": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The recipe accent slot is runtime-visible, but this character asset is not shipped in the current whitelist."
		},
		"graveyard-kit/crypt": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"graveyard-kit/gravestone": {
			pack: "fantasy-town-kit",
			assetId: "wall-corner",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"graveyard-kit/keeper": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-cave-kit/room": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"modular-cave-kit/gate-rock": {
			pack: "fantasy-town-kit",
			assetId: "wall-corner",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"pirate-kit/dock": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"pirate-kit/tower": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"pirate-kit/ship": {
			pack: "fantasy-town-kit",
			assetId: "stall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"holiday-kit/cabin": {
			pack: "fantasy-town-kit",
			assetId: "wall-doorway-square",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"holiday-kit/snow": {
			pack: "fantasy-town-kit",
			assetId: "roof",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"holiday-kit/lights": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"survival-kit/tent": {
			pack: "fantasy-town-kit",
			assetId: "stall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"survival-kit/campfire": {
			pack: "fantasy-town-kit",
			assetId: "fountain-round",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"survival-kit/resource": {
			pack: "fantasy-town-kit",
			assetId: "stall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"minigolf-kit/spline": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"minigolf-kit/ramp": {
			pack: "fantasy-town-kit",
			assetId: "roof",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"minigolf-kit/flag": {
			pack: "fantasy-town-kit",
			assetId: "lantern",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-skate/rail": {
			pack: "fantasy-town-kit",
			assetId: "wall",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		},
		"mini-skate/half-pipe": {
			pack: "fantasy-town-kit",
			assetId: "roof",
			reason: "The requested Kenney pack is catalogued but not shipped in this runtime whitelist."
		}
	},
	packs: [{
		id: "nature-kit",
		folder: "kenney_nature-kit",
		title: "Nature Kit",
		version: "2.1",
		source: "https://kenney.nl/assets/nature-kit",
		materialMode: "unlit-color",
		license: {
			spdx: "CC0-1.0",
			file: "kenney_nature-kit/License.txt",
			sha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
			textCheck: "Creative Commons Zero, CC0 + commercial use",
			commercialUse: !0
		}
	}, {
		id: "fantasy-town-kit",
		folder: "kenney_fantasy-town-kit_2.0",
		title: "Fantasy Town Kit",
		version: "2.0",
		source: "https://kenney.nl/assets/fantasy-town-kit",
		materialMode: "external-colormap",
		license: {
			spdx: "CC0-1.0",
			file: "kenney_fantasy-town-kit_2.0/License.txt",
			sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
			textCheck: "Creative Commons Zero, CC0 + commercial use",
			commercialUse: !0
		}
	}],
	assets: [
		{
			type: "model",
			id: "nature-rock_largeA",
			assetId: "rock_largeA",
			src: "/kenney/r01/nature/rock_largeA.glb",
			bytes: 7552,
			sha256: "6dd15390fd96501dcd1454765a17ba61dbbd8d47705dfe5149c8dd92b353ce25",
			source: "kenney_nature-kit/Models/GLTF format/rock_largeA.glb",
			pack: "nature-kit",
			version: "2.1",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_nature-kit/License.txt",
				sha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["rock", "terrain-dressing"],
			dependencies: [],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_nature-kit/Models/GLTF format/rock_largeA.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "nature-rock_smallA",
			assetId: "rock_smallA",
			src: "/kenney/r01/nature/rock_smallA.glb",
			bytes: 3044,
			sha256: "df9fff9d711e61370e8df0caa2514c89b8f8a8dc6c6fafaf4eb2ec79c5ae07c1",
			source: "kenney_nature-kit/Models/GLTF format/rock_smallA.glb",
			pack: "nature-kit",
			version: "2.1",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_nature-kit/License.txt",
				sha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["rock", "terrain-dressing"],
			dependencies: [],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_nature-kit/Models/GLTF format/rock_smallA.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-wall",
			assetId: "wall",
			src: "/kenney/r01/fantasy-town/wall.glb",
			bytes: 4792,
			sha256: "cab1dff37610e2a214237cc62ec0b1506e8fd76bb66c29f6c585b4b643b569c4",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/wall.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["structure", "settlement-anchor"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/wall.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-wall-corner",
			assetId: "wall-corner",
			src: "/kenney/r01/fantasy-town/wall-corner.glb",
			bytes: 6788,
			sha256: "d67d4c6210d5e877ce24ccfb42cb3eab1576f7addb689924e7776d6b73e4165a",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/wall-corner.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["structure", "settlement-anchor"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/wall-corner.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-wall-doorway-square",
			assetId: "wall-doorway-square",
			src: "/kenney/r01/fantasy-town/wall-doorway-square.glb",
			bytes: 7844,
			sha256: "1ad6ca0f201c602d7ead56f395744ffd87ba8e5d6e16148d60d0c13e31cf85f3",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/wall-doorway-square.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["structure", "landmark"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/wall-doorway-square.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-roof",
			assetId: "roof",
			src: "/kenney/r01/fantasy-town/roof.glb",
			bytes: 9324,
			sha256: "8f245dfc04b8e76b2833081462f7530c2aea9114a703161c1d9a4a975927347d",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/roof.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["structure", "silhouette"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/roof.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-roof-gable",
			assetId: "roof-gable",
			src: "/kenney/r01/fantasy-town/roof-gable.glb",
			bytes: 7632,
			sha256: "4bb6bdbcadbb8ebeb69d720e29f6c2e57c99d98966baa41fd86914d3c13d6039",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/roof-gable.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["structure", "hero-architecture"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/roof-gable.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-fountain-round",
			assetId: "fountain-round",
			src: "/kenney/r01/fantasy-town/fountain-round.glb",
			bytes: 84848,
			sha256: "8d19741e2cca6cbdce114b950b4aa12af625979bbc17b2910ef2366834af5565",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/fountain-round.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["landmark", "water-feature"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/fountain-round.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: "Water material contains alpha; retain the source material settings."
			}
		},
		{
			type: "model",
			id: "fantasy-town-stall",
			assetId: "stall",
			src: "/kenney/r01/fantasy-town/stall.glb",
			bytes: 11500,
			sha256: "f0a636fccb7d57c38f5acd58881c468f4872f1bcda1e9fd9b1118e76110565a1",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/stall.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["prop", "settlement-dressing"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/stall.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-lantern",
			assetId: "lantern",
			src: "/kenney/r01/fantasy-town/lantern.glb",
			bytes: 14984,
			sha256: "f270637e3083d6e84a30626ee05df2b09597a642985a7f5c3e4ab5bb1c7a8d55",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/lantern.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["prop", "wayfinding"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/lantern.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-stall-bench",
			assetId: "stall-bench",
			src: "/kenney/r01/fantasy-town/stall-bench.glb",
			bytes: 14168,
			sha256: "5a4b379488241394916991c4b482ec4863c05bb548ca8751f5c3935f1f6e5b9c",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/stall-bench.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["prop", "facility-seating"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/stall-bench.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		},
		{
			type: "model",
			id: "fantasy-town-cart",
			assetId: "cart",
			src: "/kenney/r01/fantasy-town/cart.glb",
			bytes: 52920,
			sha256: "63503cd0a7398310e01aabc8e3663f711a7517394d23d179d0695157fee99d40",
			source: "kenney_fantasy-town-kit_2.0/Models/GLB format/cart.glb",
			pack: "fantasy-town-kit",
			version: "2.0",
			license: {
				spdx: "CC0-1.0",
				file: "kenney_fantasy-town-kit_2.0/License.txt",
				sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
				textCheck: "Creative Commons Zero, CC0 + commercial use",
				commercialUse: !0
			},
			roles: ["prop", "market-companion"],
			dependencies: ["/kenney/r01/fantasy-town/Textures/colormap.png"],
			provenance: {
				sourceRoot: "local-donor:Kenney",
				sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/cart.glb",
				importedBy: "apps/university/scripts/import-kenney-r01.mjs",
				recipe: "R01-forest-academy",
				status: "prototype/local donor; PGS donor registered",
				notes: null
			}
		}
	],
	dependencies: [{
		type: "texture",
		uri: "Textures/colormap.png",
		src: "/kenney/r01/fantasy-town/Textures/colormap.png",
		bytes: 11143,
		sha256: "4aac939dc33195e35caf8c382ee3cb170054da763577f22d3c22692ec6afccdf",
		source: "kenney_fantasy-town-kit_2.0/Models/GLB format/Textures/colormap.png",
		pack: "fantasy-town-kit",
		version: "2.0",
		license: {
			spdx: "CC0-1.0",
			file: "kenney_fantasy-town-kit_2.0/License.txt",
			sha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
			textCheck: "Creative Commons Zero, CC0 + commercial use",
			commercialUse: !0
		},
		provenance: {
			sourceRoot: "local-donor:Kenney",
			sourceRelative: "kenney_fantasy-town-kit_2.0/Models/GLB format/Textures/colormap.png",
			importedBy: "apps/university/scripts/import-kenney-r01.mjs",
			status: "prototype/local donor; PGS donor registered"
		}
	}],
	summary: {
		modelCount: 12,
		dependencyCount: 1,
		totalBytes: 236539
	}
}, bt = vt, xt = /* @__PURE__ */ new Map();
for (let e of [...yt.assets, ...bt.assets]) e.type === "model" && xt.set(`${e.pack}/${e.assetId}`, {
	pack: e.pack,
	assetId: e.assetId,
	src: e.src,
	bytes: e.bytes,
	source: e.source
});
var St = /* @__PURE__ */ new Map(), Ct = yt.runtimeFallbacks ?? {};
function wt(e, t) {
	let n = `${e}/${t}`, r = xt.get(n);
	if (r) return {
		...r,
		requestedPack: e,
		requestedAssetId: t,
		usedFallback: !1
	};
	let i = Ct[n];
	if (!i) return null;
	let a = xt.get(`${i.pack}/${i.assetId}`);
	return a ? {
		...a,
		requestedPack: e,
		requestedAssetId: t,
		usedFallback: !0,
		fallbackReason: i.reason
	} : null;
}
function Tt(e, t) {
	return wt(e, t);
}
function Et(e, t) {
	let n = `${e}/${t}`, r = St.get(n);
	return r ? {
		...r,
		requestedPack: e,
		requestedAssetId: t,
		usedFallback: !1
	} : wt(e, t);
}
var Dt = .1, Ot = {
	shadow: new o.Color(2574125),
	mid: new o.Color(6198601),
	highlight: new o.Color(11851884)
}, kt = [
	{
		along: 0,
		up: .68,
		side: 0,
		radiusX: .38,
		radiusY: .32,
		radiusZ: .36,
		yaw: 0
	},
	{
		along: -.16,
		up: .5,
		side: .05,
		radiusX: .3,
		radiusY: .24,
		radiusZ: .28,
		yaw: .55
	},
	{
		along: .15,
		up: .48,
		side: -.07,
		radiusX: .29,
		radiusY: .23,
		radiusZ: .27,
		yaw: -.62
	}
], At = [
	{
		along: 0,
		up: .37,
		side: 0,
		radiusX: .49,
		radiusY: .44,
		radiusZ: .45,
		yaw: 0
	},
	{
		along: -.16,
		up: .26,
		side: .08,
		radiusX: .32,
		radiusY: .31,
		radiusZ: .31,
		yaw: .7
	},
	{
		along: .15,
		up: .23,
		side: -.07,
		radiusX: .3,
		radiusY: .28,
		radiusZ: .29,
		yaw: -.8
	}
], jt = new o.Vector3(0, 1, 0), Mt = {
	min: .94,
	span: .12
};
function Nt(e, t) {
	return t * Math.max(...(e === "tree" ? kt : At).map((e) => Math.hypot(e.along, e.side) + Math.max(e.radiusX, e.radiusY, e.radiusZ) * (Mt.min + Mt.span)));
}
function Pt(e, t = 0) {
	let n = new o.IcosahedronGeometry(1, e);
	n.deleteAttribute("uv"), n.deleteAttribute("normal");
	let r = oe(n);
	if (n.dispose(), r.computeVertexNormals(), t > 0) {
		let e = r.getAttribute("normal"), n = new o.Vector3(0, t, 0), i = new o.Vector3();
		for (let t = 0; t < e.count; t += 1) i.fromBufferAttribute(e, t), i.add(n).normalize(), e.setXYZ(t, i.x, i.y, i.z);
		e.needsUpdate = !0;
	}
	return r;
}
function Ft(e, t, n, r = 0) {
	let i = R(`${n}/${e.shapeSeed ?? `${e.position.x}/${e.position.z}`}/${e.turn}`), a = e.height, s = e.foliageTint === void 0 ? Ot.mid : new o.Color(e.foliageTint), c = (i() - .5) * .4, l = [];
	for (let [n, u] of t.entries()) {
		let t = Mt.min + i() * Mt.span, d = e.turn + u.yaw + c + (i() - .5) * .18, f = (i() - .5) * .16, p = new o.Vector3(u.along * a, u.up * a - r + (e.groundOffsets?.[n] ?? 0), u.side * a);
		p.applyAxisAngle(jt, e.turn), l.push({
			position: new o.Vector3(e.position.x + p.x, e.position.y + p.y, e.position.z + p.z),
			quaternion: new o.Quaternion().setFromEuler(new o.Euler(f, d, 0, "YXZ")),
			scale: new o.Vector3(u.radiusX * a * t, u.radiusY * a * t, u.radiusZ * a * t),
			color: s.clone().multiplyScalar(n === 0 ? 1 : n === 1 ? .96 : .93)
		});
	}
	return l;
}
function It(e) {
	return Ft(e, At, "bush-crown", e.height * .06);
}
var Lt;
function Rt() {
	if (!Lt) {
		let e = Pt(1), t = e.getAttribute("position");
		Lt = Array.from({ length: t.count }, (e, n) => new o.Vector3().fromBufferAttribute(t, n)), e.dispose();
	}
	return Lt;
}
function zt(e, t) {
	let n = Rt(), r = new o.Vector3();
	return It({
		...e,
		groundOffsets: void 0
	}).map((i) => {
		let a = Infinity;
		for (let e of n) r.copy(e).multiply(i.scale).applyQuaternion(i.quaternion).add(i.position), a = Math.min(a, r.y);
		let o = -Infinity;
		for (let s of n) r.copy(s).multiply(i.scale).applyQuaternion(i.quaternion).add(i.position), r.y <= a + e.height * 1e-6 && (o = Math.max(o, r.y - t(r.x, r.z)));
		return -Math.max(0, o + .01);
	});
}
//#endregion
//#region src/island/miniature-bevel.ts
function Bt(e, t = Math.min(...e) * .16) {
	if (!e.every((e) => Number.isFinite(e) && e > 0) || !Number.isFinite(t) || t <= 0 || t >= Math.min(...e) / 2) throw RangeError("A miniature bevel must fit inside its solid");
	let n = e.map((e) => e / 2), r = [], i = (e, r) => new o.Vector3(...n.map((n, i) => r[i] * (n - (i === e ? 0 : t)))), a = (e) => {
		let t = e[1].clone().sub(e[0]).cross(e[2].clone().sub(e[0])), n = e.reduce((e, t) => e.add(t), new o.Vector3());
		t.dot(n) < 0 && e.reverse();
		for (let t = 1; t < e.length - 1; t++) for (let n of [
			e[0],
			e[t],
			e[t + 1]
		]) r.push(n.x, n.y, n.z);
	};
	for (let e = 0; e < 3; e++) for (let t of [-1, 1]) {
		let n = [
			0,
			1,
			2
		].filter((t) => t !== e);
		a([
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		].map(([r, a]) => {
			let o = [
				0,
				0,
				0
			];
			return o[e] = t, o[n[0]] = r, o[n[1]] = a, i(e, o);
		}));
	}
	for (let e = 0; e < 3; e++) for (let t = e + 1; t < 3; t++) {
		let n = 3 - e - t;
		for (let r of [-1, 1]) for (let o of [-1, 1]) {
			let s = [
				0,
				0,
				0
			];
			s[e] = r, s[t] = o, s[n] = -1;
			let c = i(e, s), l = i(t, s);
			s[n] = 1, a([
				c,
				l,
				i(t, s),
				i(e, s)
			]);
		}
	}
	for (let e of [-1, 1]) for (let t of [-1, 1]) for (let n of [-1, 1]) a([
		0,
		1,
		2
	].map((r) => i(r, [
		e,
		t,
		n
	])));
	let s = new o.BufferGeometry();
	return s.setAttribute("position", new o.Float32BufferAttribute(r, 3)), s.setIndex(Array.from({ length: r.length / 3 }, (e, t) => t)), s.computeVertexNormals(), s.computeBoundingBox(), s.computeBoundingSphere(), s;
}
var Vt = {
	schemaVersion: 1,
	license: "CC0-1.0",
	author: "Kenney",
	sourceUrl: "https://kenney.nl/assets/nature-kit",
	licenseSha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
	palette: "University mineral/leaf vertex colours replace the source palette; no texture copied",
	assets: [
		{
			id: "rock_largeA",
			source: "kenney_nature-kit/Models/GLTF format/rock_largeA.glb",
			sha256: "6dd15390fd96501dcd1454765a17ba61dbbd8d47705dfe5149c8dd92b353ce25",
			adaptation: "welded, normalized original mesh",
			vertices: [
				[
					.1310161,
					.5555556,
					.7038761
				],
				[
					-.5671557,
					.5555556,
					-.1167879
				],
				[
					.0904012,
					1,
					.4856743
				],
				[
					-.3913375,
					1,
					-.0805837
				],
				[
					-.3663766,
					.5555556,
					-.861505
				],
				[
					.3553502,
					.5555556,
					-.762293
				],
				[
					-.3095882,
					.7777779,
					-.7279715
				],
				[
					-.0038041,
					1,
					-.5602103
				],
				[
					.2451916,
					1,
					-.5259822
				],
				[
					-.4423815,
					0,
					-.0910946
				],
				[
					-.5194062,
					0,
					-.3819002
				],
				[
					-.5671557,
					.2916667,
					-.1167879
				],
				[
					-.6659052,
					.2916667,
					-.4896157
				],
				[
					-.2857737,
					0,
					-.6719739
				],
				[
					.1021926,
					0,
					.5490231
				],
				[
					.2771731,
					0,
					-.5945886
				],
				[
					.2938956,
					0,
					.6719739
				],
				[
					.3975207,
					0,
					.0412044
				],
				[
					.5194062,
					0,
					-.2338314
				],
				[
					.3975207,
					0,
					.4464923
				],
				[
					.4849359,
					0,
					.6109315
				],
				[
					-.3663766,
					.2916667,
					-.861505
				],
				[
					.3553502,
					.2916667,
					-.762293
				],
				[
					-.6659052,
					.5555556,
					-.4896157
				],
				[
					.509642,
					.2916667,
					.0528261
				],
				[
					.509642,
					.5555556,
					.0528261
				],
				[
					.6659052,
					.2916667,
					-.2997839
				],
				[
					.6659052,
					.5555556,
					-.2997839
				],
				[
					.1310161,
					.2916667,
					.7038761
				],
				[
					.3767891,
					.2916667,
					.861505
				],
				[
					-.3561372,
					1,
					-.4661366
				],
				[
					-.4594746,
					1,
					-.3378348
				],
				[
					.6217126,
					.2916667,
					.7832455
				],
				[
					.4594746,
					1,
					-.2068509
				],
				[
					.6217126,
					.5555556,
					.7832455
				],
				[
					.4289817,
					1,
					.5404395
				],
				[
					.509642,
					.5555556,
					.572426
				],
				[
					.351653,
					1,
					.3949739
				],
				[
					.2599845,
					1,
					.5944384
				],
				[
					.3767891,
					.5555556,
					.861505
				],
				[
					.509642,
					.2916667,
					.572426
				],
				[
					.351653,
					1,
					.03645
				]
			],
			faces: [
				[
					2,
					1,
					0
				],
				[
					1,
					2,
					3
				],
				[
					6,
					5,
					4
				],
				[
					5,
					6,
					7
				],
				[
					5,
					7,
					8
				],
				[
					11,
					10,
					9
				],
				[
					10,
					11,
					12
				],
				[
					13,
					9,
					10
				],
				[
					9,
					13,
					14
				],
				[
					14,
					13,
					15
				],
				[
					14,
					15,
					16
				],
				[
					16,
					15,
					17
				],
				[
					17,
					15,
					18
				],
				[
					19,
					16,
					17
				],
				[
					16,
					19,
					20
				],
				[
					4,
					22,
					21
				],
				[
					22,
					4,
					5
				],
				[
					23,
					11,
					1
				],
				[
					11,
					23,
					12
				],
				[
					26,
					25,
					24
				],
				[
					25,
					26,
					27
				],
				[
					22,
					18,
					15
				],
				[
					18,
					22,
					26
				],
				[
					16,
					28,
					14
				],
				[
					28,
					16,
					29
				],
				[
					7,
					6,
					30
				],
				[
					31,
					4,
					23
				],
				[
					4,
					31,
					30
				],
				[
					4,
					30,
					6
				],
				[
					1,
					28,
					0
				],
				[
					28,
					1,
					11
				],
				[
					17,
					26,
					24
				],
				[
					26,
					17,
					18
				],
				[
					20,
					29,
					16
				],
				[
					29,
					20,
					32
				],
				[
					33,
					5,
					8
				],
				[
					5,
					33,
					27
				],
				[
					36,
					35,
					34
				],
				[
					35,
					36,
					37
				],
				[
					22,
					13,
					21
				],
				[
					13,
					22,
					15
				],
				[
					39,
					35,
					38
				],
				[
					35,
					39,
					34
				],
				[
					11,
					14,
					28
				],
				[
					14,
					11,
					9
				],
				[
					40,
					34,
					32
				],
				[
					34,
					40,
					36
				],
				[
					20,
					40,
					32
				],
				[
					40,
					20,
					19
				],
				[
					39,
					28,
					29
				],
				[
					28,
					39,
					0
				],
				[
					25,
					37,
					36
				],
				[
					37,
					25,
					41
				],
				[
					27,
					41,
					25
				],
				[
					41,
					27,
					33
				],
				[
					34,
					29,
					32
				],
				[
					29,
					34,
					39
				],
				[
					22,
					27,
					26
				],
				[
					27,
					22,
					5
				],
				[
					19,
					24,
					40
				],
				[
					24,
					19,
					17
				],
				[
					4,
					12,
					23
				],
				[
					12,
					4,
					21
				],
				[
					24,
					36,
					40
				],
				[
					36,
					24,
					25
				],
				[
					31,
					1,
					3
				],
				[
					1,
					31,
					23
				],
				[
					38,
					0,
					39
				],
				[
					0,
					38,
					2
				],
				[
					21,
					10,
					12
				],
				[
					10,
					21,
					13
				],
				[
					35,
					37,
					38
				],
				[
					41,
					38,
					37
				],
				[
					8,
					38,
					41
				],
				[
					8,
					2,
					38
				],
				[
					7,
					2,
					8
				],
				[
					30,
					2,
					7
				],
				[
					30,
					3,
					2
				],
				[
					3,
					30,
					31
				],
				[
					8,
					41,
					33
				]
			]
		},
		{
			id: "rock_largeD",
			source: "kenney_nature-kit/Models/GLTF format/rock_largeD.glb",
			sha256: "e4fefd8d8d7deab42be61bd222bcd088330012f0025789146b81f25a46095ffd",
			adaptation: "welded, normalized, closed convex hull",
			vertices: [
				[
					.6226365,
					1,
					-.1971875
				],
				[
					.3879973,
					1,
					-.50344
				],
				[
					.9070246,
					.5493811,
					-.2650336
				],
				[
					.9070246,
					.4142857,
					-.3966548
				],
				[
					.6198404,
					.4142857,
					-.7714892
				],
				[
					.1754245,
					0,
					-.7088918
				],
				[
					.49452,
					0,
					-.6265975
				],
				[
					.2209714,
					.4142857,
					-.8743567
				],
				[
					.1015938,
					.4142857,
					.8743567
				],
				[
					-.7538437,
					.4142857,
					.3965663
				],
				[
					.0615018,
					1,
					.5334426
				],
				[
					-.477424,
					1,
					.2324348
				],
				[
					.3271227,
					.7071429,
					.5414053
				],
				[
					.1564173,
					1,
					.4706382
				],
				[
					-.573928,
					1,
					-.1291403
				],
				[
					-.9070246,
					.4142857,
					-.1773624
				],
				[
					-.4932707,
					1,
					-.2915428
				],
				[
					-.5964906,
					.4142857,
					-.8026201
				],
				[
					-.4873909,
					.7071429,
					-.6628363
				],
				[
					.1367097,
					1,
					-.5682465
				],
				[
					-.1207908,
					1,
					-.5456496
				],
				[
					-.2622527,
					0,
					.4989626
				],
				[
					-.6044277,
					0,
					.3078465
				],
				[
					.0934902,
					.259372,
					.8054493
				],
				[
					.8616348,
					.1433961,
					-.2542049
				],
				[
					-.7269727,
					0,
					-.1512964
				],
				[
					.7924751,
					0,
					-.2377055
				],
				[
					-.2003639,
					0,
					-.6759145
				],
				[
					-.5375178,
					.2071429,
					-.7270614
				],
				[
					.4029127,
					.4142857,
					.674977
				],
				[
					.1868786,
					0,
					.619307
				],
				[
					-.6027587,
					0,
					-.4013996
				],
				[
					.3209775,
					0,
					.5305752
				]
			],
			faces: [
				[
					1,
					4,
					7
				],
				[
					4,
					5,
					7
				],
				[
					5,
					28,
					7
				],
				[
					28,
					17,
					7
				],
				[
					17,
					18,
					7
				],
				[
					18,
					19,
					7
				],
				[
					19,
					1,
					7
				],
				[
					0,
					2,
					1
				],
				[
					2,
					3,
					1
				],
				[
					3,
					4,
					1
				],
				[
					19,
					20,
					16
				],
				[
					19,
					16,
					14
				],
				[
					19,
					14,
					11
				],
				[
					19,
					11,
					10
				],
				[
					19,
					10,
					13
				],
				[
					19,
					13,
					0
				],
				[
					19,
					0,
					1
				],
				[
					3,
					24,
					4
				],
				[
					24,
					6,
					4
				],
				[
					6,
					5,
					4
				],
				[
					6,
					26,
					32
				],
				[
					6,
					32,
					30
				],
				[
					6,
					30,
					21
				],
				[
					6,
					21,
					22
				],
				[
					6,
					22,
					25
				],
				[
					6,
					25,
					31
				],
				[
					6,
					31,
					27
				],
				[
					6,
					27,
					5
				],
				[
					27,
					28,
					5
				],
				[
					31,
					25,
					28
				],
				[
					25,
					15,
					28
				],
				[
					15,
					17,
					28
				],
				[
					27,
					31,
					28
				],
				[
					15,
					14,
					17
				],
				[
					14,
					18,
					17
				],
				[
					14,
					16,
					18
				],
				[
					16,
					20,
					18
				],
				[
					20,
					19,
					18
				],
				[
					12,
					29,
					0
				],
				[
					29,
					2,
					0
				],
				[
					13,
					12,
					0
				],
				[
					24,
					3,
					2
				],
				[
					29,
					24,
					2
				],
				[
					29,
					26,
					24
				],
				[
					26,
					6,
					24
				],
				[
					22,
					9,
					25
				],
				[
					9,
					15,
					25
				],
				[
					9,
					14,
					15
				],
				[
					9,
					11,
					14
				],
				[
					13,
					29,
					12
				],
				[
					32,
					26,
					29
				],
				[
					13,
					10,
					29
				],
				[
					10,
					8,
					29
				],
				[
					8,
					32,
					29
				],
				[
					21,
					23,
					22
				],
				[
					23,
					8,
					22
				],
				[
					8,
					9,
					22
				],
				[
					8,
					10,
					9
				],
				[
					10,
					11,
					9
				],
				[
					8,
					30,
					32
				],
				[
					23,
					30,
					8
				],
				[
					30,
					23,
					21
				]
			]
		},
		{
			id: "rock_largeF",
			source: "kenney_nature-kit/Models/GLTF format/rock_largeF.glb",
			sha256: "4222107db4a47471494bdbf1eb2ad0ff297628afbcb7c392618e5742d831e0d4",
			adaptation: "welded, normalized, closed convex hull",
			vertices: [
				[
					.7421895,
					0,
					-.0735571
				],
				[
					.9277366,
					.440678,
					-.0963691
				],
				[
					.1423047,
					0,
					-.6055354
				],
				[
					.1778809,
					.440678,
					-.761342
				],
				[
					-.5111556,
					.2899104,
					.7434179
				],
				[
					-.4389605,
					0,
					.6409169
				],
				[
					-.6860192,
					.440678,
					.6433002
				],
				[
					-.9277366,
					.440678,
					.3732357
				],
				[
					-.6280064,
					0,
					.4297006
				],
				[
					-.8349627,
					.220339,
					.3376813
				],
				[
					-.6280064,
					0,
					.1227099
				],
				[
					.245429,
					0,
					.4766795
				],
				[
					.6508298,
					.220339,
					.4739958
				],
				[
					.723144,
					.440678,
					.5246965
				],
				[
					-.4365734,
					.440678,
					.761342
				],
				[
					-.5111556,
					.540396,
					.7434179
				],
				[
					-.3381093,
					1,
					.4977307
				],
				[
					.6603523,
					0,
					.1748691
				],
				[
					.5843729,
					.7203389,
					.4274021
				],
				[
					.5086364,
					1,
					.1387574
				],
				[
					.5716712,
					1,
					-.0525929
				],
				[
					.1890417,
					1,
					.3712269
				],
				[
					-.7497039,
					.7203389,
					.3050066
				],
				[
					-.4837219,
					1,
					.0985817
				],
				[
					-.4624245,
					1,
					.3588363
				],
				[
					-.3756118,
					0,
					-.4278096
				],
				[
					-.4695148,
					.440678,
					-.5391847
				],
				[
					-.289315,
					1,
					-.3254559
				],
				[
					.1096102,
					1,
					-.4623492
				]
			],
			faces: [
				[
					2,
					25,
					3
				],
				[
					25,
					26,
					3
				],
				[
					26,
					27,
					3
				],
				[
					27,
					28,
					3
				],
				[
					28,
					20,
					3
				],
				[
					20,
					1,
					3
				],
				[
					1,
					0,
					3
				],
				[
					0,
					2,
					3
				],
				[
					0,
					17,
					11
				],
				[
					0,
					11,
					5
				],
				[
					0,
					5,
					8
				],
				[
					0,
					8,
					10
				],
				[
					0,
					10,
					25
				],
				[
					0,
					25,
					2
				],
				[
					10,
					9,
					25
				],
				[
					9,
					7,
					25
				],
				[
					7,
					26,
					25
				],
				[
					7,
					27,
					26
				],
				[
					7,
					22,
					27
				],
				[
					22,
					23,
					27
				],
				[
					23,
					24,
					16
				],
				[
					23,
					16,
					21
				],
				[
					23,
					21,
					19
				],
				[
					23,
					19,
					20
				],
				[
					23,
					20,
					28
				],
				[
					23,
					28,
					27
				],
				[
					19,
					13,
					20
				],
				[
					13,
					1,
					20
				],
				[
					13,
					12,
					1
				],
				[
					12,
					0,
					1
				],
				[
					12,
					17,
					0
				],
				[
					8,
					9,
					10
				],
				[
					8,
					5,
					9
				],
				[
					5,
					7,
					9
				],
				[
					5,
					6,
					7
				],
				[
					6,
					24,
					7
				],
				[
					24,
					22,
					7
				],
				[
					24,
					23,
					22
				],
				[
					18,
					13,
					19
				],
				[
					21,
					18,
					19
				],
				[
					18,
					16,
					13
				],
				[
					16,
					15,
					13
				],
				[
					15,
					14,
					13
				],
				[
					14,
					4,
					13
				],
				[
					4,
					5,
					13
				],
				[
					5,
					12,
					13
				],
				[
					11,
					17,
					12
				],
				[
					5,
					11,
					12
				],
				[
					4,
					6,
					5
				],
				[
					4,
					15,
					6
				],
				[
					15,
					16,
					6
				],
				[
					16,
					24,
					6
				],
				[
					21,
					16,
					18
				],
				[
					4,
					14,
					15
				]
			]
		},
		{
			id: "plant_flatShort",
			source: "kenney_nature-kit/Models/GLTF format/plant_flatShort.glb",
			sha256: "5885f6bb6ce004eb7ccc887fd30b7671492a94be76ffeb1e64c07c47d6b7bae1",
			adaptation: "welded, normalized original mesh",
			vertices: [
				[
					-.6685483,
					0,
					-0
				],
				[
					-0,
					0,
					-.6685483
				],
				[
					0,
					.2223582,
					-0
				],
				[
					-0,
					.5497514,
					-.2840256
				],
				[
					-0,
					.3003291,
					-.589742
				],
				[
					-0,
					.6621761,
					-.688488
				],
				[
					0,
					1,
					-0
				],
				[
					-0,
					.2134034,
					-1
				],
				[
					0,
					.5497514,
					.2840256
				],
				[
					0,
					.3003291,
					.589742
				],
				[
					0,
					.6621761,
					.688488
				],
				[
					0,
					0,
					.6685483
				],
				[
					0,
					.2134034,
					1
				],
				[
					.6685483,
					0,
					-0
				],
				[
					1,
					.2134034,
					-0
				],
				[
					.589742,
					.3003291,
					-0
				],
				[
					.2840256,
					.5497514,
					-0
				],
				[
					.688488,
					.6621761,
					-0
				],
				[
					-.2840256,
					.5497514,
					-0
				],
				[
					-.589742,
					.3003291,
					-0
				],
				[
					-.688488,
					.6621761,
					0
				],
				[
					-1,
					.2134034,
					0
				]
			],
			faces: [
				[
					2,
					1,
					0
				],
				[
					5,
					4,
					3
				],
				[
					1,
					3,
					4
				],
				[
					2,
					3,
					1
				],
				[
					3,
					2,
					6
				],
				[
					1,
					4,
					7
				],
				[
					2,
					6,
					8
				],
				[
					2,
					8,
					9
				],
				[
					8,
					10,
					9
				],
				[
					11,
					2,
					9
				],
				[
					9,
					12,
					11
				],
				[
					2,
					14,
					13
				],
				[
					14,
					2,
					15
				],
				[
					15,
					2,
					16
				],
				[
					16,
					2,
					6
				],
				[
					17,
					15,
					16
				],
				[
					2,
					18,
					6
				],
				[
					2,
					19,
					18
				],
				[
					20,
					18,
					19
				],
				[
					2,
					21,
					19
				],
				[
					21,
					2,
					0
				],
				[
					13,
					2,
					11
				],
				[
					11,
					2,
					0
				],
				[
					13,
					1,
					2
				]
			]
		},
		{
			id: "plant_bush",
			source: "kenney_nature-kit/Models/GLTF format/plant_bush.glb",
			sha256: "ae7b1beb39e242b13f5f29e3ec23ef21034b814f82297b8aa00a9bf4e1b09590",
			adaptation: "welded, normalized original mesh",
			vertices: [
				[
					-.3636364,
					.6400002,
					-.7077973
				],
				[
					-0,
					.6082072,
					-1
				],
				[
					.3636364,
					.6400002,
					-.7077973
				],
				[
					-.3636364,
					.6400002,
					.7077973
				],
				[
					-.3636364,
					.4812039,
					.3719691
				],
				[
					.3636364,
					.6400002,
					.7077973
				],
				[
					.3636364,
					.4812039,
					.3719691
				],
				[
					0,
					0,
					-0
				],
				[
					-.3636364,
					.4812039,
					-.3719691
				],
				[
					.3636364,
					.4812039,
					-.3719691
				],
				[
					-.7077973,
					1,
					.3636364
				],
				[
					-.7077973,
					1,
					-.3636364
				],
				[
					-.3719691,
					.7518811,
					.3636364
				],
				[
					-.3719691,
					.7518811,
					-.3636364
				],
				[
					.7077973,
					1,
					.3636364
				],
				[
					.7077973,
					1,
					-.3636364
				],
				[
					1,
					.9503241,
					-0
				],
				[
					.3719691,
					.7518811,
					.3636364
				],
				[
					.3719691,
					.7518811,
					-.3636364
				],
				[
					-1,
					.9503241,
					0
				],
				[
					0,
					.6082072,
					1
				]
			],
			faces: [
				[
					2,
					1,
					0
				],
				[
					5,
					4,
					3
				],
				[
					4,
					5,
					6
				],
				[
					6,
					7,
					4
				],
				[
					9,
					0,
					8
				],
				[
					0,
					9,
					2
				],
				[
					12,
					11,
					10
				],
				[
					11,
					12,
					13
				],
				[
					8,
					7,
					9
				],
				[
					16,
					15,
					14
				],
				[
					14,
					18,
					17
				],
				[
					18,
					14,
					15
				],
				[
					18,
					7,
					17
				],
				[
					11,
					19,
					10
				],
				[
					5,
					3,
					20
				],
				[
					13,
					12,
					7
				]
			]
		},
		{
			id: "mushroom_tan",
			source: "kenney_nature-kit/Models/GLTF format/mushroom_tan.glb",
			sha256: "455cbacdcdac82cc20420c3f21eaba3ff2fbceadb2e13d35a39d52130dba5a80",
			adaptation: "welded, normalized original mesh",
			vertices: [
				[
					-.6495192,
					.4102631,
					.3750002
				],
				[
					-.3566734,
					.4102631,
					-.3976836
				],
				[
					-.6495192,
					.4102631,
					-.3750002
				],
				[
					-0,
					.4102631,
					-.7499999
				],
				[
					.3385074,
					.4102631,
					-.3976836
				],
				[
					.6495191,
					.4102631,
					-.3750002
				],
				[
					.3385074,
					.4102631,
					.2974972
				],
				[
					-.3566734,
					.4102631,
					.2974972
				],
				[
					-0,
					.4102631,
					.7499999
				],
				[
					.6495191,
					.4102631,
					.3750002
				],
				[
					-.433477,
					0,
					-.4707592
				],
				[
					-.433477,
					0,
					.3796806
				],
				[
					.4169627,
					0,
					-.4707592
				],
				[
					.4169627,
					0,
					.3796806
				],
				[
					-.8660254,
					.5683695,
					.4999999
				],
				[
					-0,
					.5683695,
					.9999999
				],
				[
					.8660254,
					.5683695,
					.4999999
				],
				[
					.8660254,
					.5683695,
					-.4999999
				],
				[
					-0,
					.5683695,
					-.9999999
				],
				[
					-.8660254,
					.5683695,
					-.4999999
				],
				[
					-.2069356,
					1,
					.1194743
				],
				[
					-0,
					1,
					.2389486
				],
				[
					-.2069356,
					1,
					-.1194743
				],
				[
					-0,
					1,
					-.2389486
				],
				[
					.2069356,
					1,
					.1194743
				],
				[
					.2069356,
					1,
					-.1194743
				]
			],
			faces: [
				[
					2,
					1,
					0
				],
				[
					1,
					2,
					3
				],
				[
					1,
					3,
					4
				],
				[
					4,
					3,
					5
				],
				[
					4,
					5,
					6
				],
				[
					7,
					0,
					1
				],
				[
					0,
					7,
					8
				],
				[
					8,
					7,
					6
				],
				[
					8,
					6,
					9
				],
				[
					9,
					6,
					5
				],
				[
					12,
					11,
					10
				],
				[
					11,
					12,
					13
				],
				[
					7,
					10,
					11
				],
				[
					10,
					7,
					1
				],
				[
					1,
					12,
					10
				],
				[
					12,
					1,
					4
				],
				[
					6,
					11,
					13
				],
				[
					11,
					6,
					7
				],
				[
					0,
					15,
					14
				],
				[
					15,
					0,
					8
				],
				[
					9,
					17,
					16
				],
				[
					17,
					9,
					5
				],
				[
					17,
					3,
					18
				],
				[
					3,
					17,
					5
				],
				[
					9,
					15,
					8
				],
				[
					15,
					9,
					16
				],
				[
					12,
					6,
					13
				],
				[
					6,
					12,
					4
				],
				[
					19,
					0,
					14
				],
				[
					0,
					19,
					2
				],
				[
					18,
					2,
					19
				],
				[
					2,
					18,
					3
				],
				[
					15,
					20,
					14
				],
				[
					20,
					15,
					21
				],
				[
					21,
					22,
					20
				],
				[
					22,
					21,
					23
				],
				[
					23,
					21,
					24
				],
				[
					23,
					24,
					25
				],
				[
					16,
					21,
					15
				],
				[
					21,
					16,
					24
				],
				[
					25,
					18,
					23
				],
				[
					18,
					25,
					17
				],
				[
					16,
					25,
					24
				],
				[
					25,
					16,
					17
				],
				[
					20,
					19,
					14
				],
				[
					19,
					20,
					22
				],
				[
					22,
					18,
					19
				],
				[
					18,
					22,
					23
				]
			],
			faceMaterials: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			],
			materialRoles: ["stem", "cap"]
		}
	]
}, Ht = {
	fir: 408,
	broadleaf: 432
}, B = {
	bark: 7753784,
	barkLight: 10119491,
	firDeep: 3106635,
	firMid: 4556629,
	firLight: 7646300,
	firTip: 10144364,
	leafDeep: 4030293,
	leafMid: 6662237,
	leafLight: 9619566,
	blossomDeep: 15241128,
	blossomMid: 15969984,
	blossomLight: 16371415,
	autumnDeep: 13133877,
	autumnMid: 15108927,
	autumnLight: 15971151,
	stoneDeep: 6648196,
	stoneMid: 8885154,
	stoneLight: 11187133,
	ruin: 10986394,
	ruinLight: 12828338,
	crystalDeep: 2794951,
	crystalMid: 5229537,
	crystalLight: 9365999,
	crystalGlint: 13171703,
	cream: 15785917,
	creamShade: 14206623,
	roof: 5214087,
	roofLight: 7711904,
	gate: 10771773,
	gateDark: 7619119,
	gold: 15054939,
	grassDeep: 5147980,
	grassMid: 7252562,
	grassLight: 9749597,
	petalPink: 15967933,
	petalCream: 16773084,
	snow: 16053997,
	snowShade: 13623775
}, Ut = [
	"fir",
	"broadleaf",
	"blossom",
	"autumn",
	"crystal",
	"ruin",
	"windmill",
	"gate",
	"snowpeak"
];
function Wt(e) {
	if (e.getIndex()) return;
	let t = e.getAttribute("position").count;
	e.setIndex(Array.from({ length: t }, (e, t) => t));
}
function Gt(e, t) {
	let n = new o.Color().setHex(t, o.SRGBColorSpace), r = e.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e += 1) n.toArray(i, e * 3);
	e.setAttribute("color", new o.BufferAttribute(i, 3));
}
function V(e, t, n, r = {}) {
	t.deleteAttribute("uv"), t.deleteAttribute("tangent"), t.clearGroups(), Wt(t), t.getAttribute("normal") || t.computeVertexNormals();
	let i = r.position ?? [
		0,
		0,
		0
	], a = r.rotation ?? [
		0,
		0,
		0
	], s = r.scale ?? [
		1,
		1,
		1
	], c = r.quaternion?.clone() ?? new o.Quaternion().setFromEuler(new o.Euler(a[0], a[1], a[2], "XYZ"));
	t.applyMatrix4(new o.Matrix4().compose(new o.Vector3(i[0], i[1], i[2]), c, new o.Vector3(s[0], s[1], s[2]))), Gt(t, n), e.push(t);
}
function H(e, t, n, r, i = [
	0,
	0,
	0
]) {
	V(e, Bt(t), r, {
		position: n,
		rotation: i
	});
}
function Kt(e, t, n, r, i, a, s, c = [
	0,
	0,
	0
]) {
	V(e, new o.CylinderGeometry(t, n, r, i), s, {
		position: a,
		rotation: c
	});
}
function qt(e, t, n, r, i, a, s) {
	V(e, new o.ConeGeometry(t, n, r), a, {
		position: i,
		quaternion: s
	});
}
function Jt(e, t, n, r, i = [
	0,
	0,
	0
], a = 0) {
	V(e, Pt(a, .45), r, {
		position: t,
		rotation: i,
		scale: n
	});
}
function Yt() {
	let e = Pt(0), t = e.toNonIndexed();
	return e.dispose(), Wt(t), t.computeVertexNormals(), t;
}
function Xt(e, t, n, r, i) {
	V(e, Yt(), r, {
		position: t,
		scale: n,
		rotation: i
	});
}
function Zt(e) {
	let t = [];
	for (let n of e) for (let e of n) t.push(e[0], e[1], e[2]);
	let n = new o.BufferGeometry();
	return n.setAttribute("position", new o.Float32BufferAttribute(t, 3)), Wt(n), n.computeVertexNormals(), n;
}
function Qt(e, t, n, r, i, a, o, s) {
	let c = s + a / o * Math.PI * 2;
	return [
		e + Math.cos(c) * n,
		i,
		t + Math.sin(c) * r
	];
}
function $t(e) {
	let t = e.phase ?? 0, n = Array.from({ length: e.sides }, (n, r) => Qt(e.bottomCenter[0], e.bottomCenter[1], e.bottomRadius[0], e.bottomRadius[1], e.bottomY, r, e.sides, t)), r = Array.from({ length: e.sides }, (n, r) => Qt(e.topCenter[0], e.topCenter[1], e.topRadius[0], e.topRadius[1], e.topY, r, e.sides, t)), i = [];
	for (let t = 0; t < e.sides; t += 1) {
		let a = (t + 1) % e.sides;
		i.push([
			n[t],
			r[a],
			n[a]
		]), i.push([
			n[t],
			r[t],
			r[a]
		]), e.capBottom && i.push([
			[
				e.bottomCenter[0],
				e.bottomY,
				e.bottomCenter[1]
			],
			n[t],
			n[a]
		]), e.capTop && i.push([
			[
				e.topCenter[0],
				e.topY,
				e.topCenter[1]
			],
			r[a],
			r[t]
		]);
	}
	return Zt(i);
}
function en(e) {
	let t = e.phase ?? 0, n = Array.from({ length: e.sides }, (n, r) => Qt(e.center[0], e.center[1], e.radius[0], e.radius[1], e.bottomY, r, e.sides, t)), r = [];
	for (let t = 0; t < e.sides; t += 1) {
		let i = (t + 1) % e.sides;
		r.push([
			n[t],
			e.tip,
			n[i]
		]), e.capBottom && r.push([
			[
				e.center[0],
				e.bottomY,
				e.center[1]
			],
			n[t],
			n[i]
		]);
	}
	return Zt(r);
}
function tn(e, t, n, r, i, a, o) {
	let s = r * .72, c = Array.from({ length: 5 }, (r, i) => Qt(e, t, n, n * .84, 0, i, 5, o)), l = Array.from({ length: 5 }, (r, c) => Qt(e + i * .72, t + a * .72, n * .72, n * .62, s, c, 5, o)), u = [
		e + i,
		r,
		t + a
	], d = [];
	for (let n = 0; n < 5; n += 1) {
		let r = (n + 1) % 5;
		d.push([
			c[n],
			l[r],
			c[r]
		]), d.push([
			c[n],
			l[n],
			l[r]
		]), d.push([
			l[n],
			u,
			l[r]
		]), d.push([
			[
				e,
				0,
				t
			],
			c[n],
			c[r]
		]);
	}
	return Zt(d);
}
function nn(e, t, n, r) {
	let i = [new o.Vector3(0, 0, 0)];
	for (let [a, s] of [[.34, .7], [.7, 1]]) {
		let c = r * a * a, l = e * a;
		i.push(new o.Vector3(c + t * s * .5, l, 0), new o.Vector3(c, l, n * .5), new o.Vector3(c - t * s * .5, l, 0), new o.Vector3(c, l, -n * .5));
	}
	i.push(new o.Vector3(r, e, 0));
	let a = [], s = new o.Vector3(r * .35, e * .52, 0), c = (e, t, n) => {
		let r = i[t].clone().sub(i[e]).cross(i[n].clone().sub(i[e])), o = i[e].clone().add(i[t]).add(i[n]).multiplyScalar(1 / 3).sub(s);
		a.push(...r.dot(o) > 0 ? [
			e,
			t,
			n
		] : [
			e,
			n,
			t
		]);
	};
	for (let e = 0; e < 4; e++) {
		let t = (e + 1) % 4;
		c(0, 1 + e, 1 + t), c(1 + e, 5 + e, 5 + t), c(1 + e, 5 + t, 1 + t), c(9, 5 + t, 5 + e);
	}
	let l = new o.BufferGeometry();
	return l.setAttribute("position", new o.Float32BufferAttribute(i.flatMap((e) => e.toArray()), 3)), l.setIndex(a), l.computeVertexNormals(), l;
}
function rn() {
	let e = [];
	Kt(e, .052, .075, .46, 6, [
		0,
		.23,
		0
	], B.bark);
	let t = new o.LatheGeometry([
		[0, .22],
		[.2, .23],
		[.315, .28],
		[.335, .33],
		[.308, .4],
		[.234, .51],
		[.211, .55],
		[.245, .56],
		[.25, .6],
		[.212, .67],
		[.16, .77],
		[.14, .78],
		[.17, .8],
		[.172, .84],
		[.14, .9],
		[.079, .99],
		[.025, 1.06],
		[0, 1.075]
	].map(([e, t]) => new o.Vector2(e, t)), 12), n = t.getAttribute("position"), r = t.getIndex(), i = [], a = new o.Vector3(), s = new o.Vector3(), c = new o.Vector3();
	for (let e = 0; e < r.count; e += 3) a.fromBufferAttribute(n, r.getX(e)), s.fromBufferAttribute(n, r.getX(e + 1)), c.fromBufferAttribute(n, r.getX(e + 2)), s.sub(a).cross(c.sub(a)).lengthSq() > 1e-14 && i.push(r.getX(e), r.getX(e + 1), r.getX(e + 2));
	t.setIndex(i);
	let l = t.getAttribute("normal");
	for (let e = 0; e < l.count; e++) a.fromBufferAttribute(l, e), a.y += .34, a.normalize(), l.setXYZ(e, a.x, a.y, a.z);
	V(e, t, B.firMid);
	let u = t.getAttribute("color"), d = new o.Color(B.firMid), f = new o.Color(B.firLight), p = new o.Color();
	for (let e = 0; e < n.count; e++) p.copy(d).lerp(f, o.MathUtils.smoothstep(n.getY(e), .35, 1.04) * .65), u.setXYZ(e, p.r, p.g, p.b);
	return e;
}
function an(e) {
	H(e, [
		.075,
		.31,
		.075
	], [
		.09,
		.51,
		0
	], B.barkLight, [
		0,
		.1,
		-.55
	]), H(e, [
		.07,
		.28,
		.07
	], [
		-.09,
		.5,
		-.015
	], B.bark, [
		.08,
		-.2,
		.62
	]);
}
function on(e = 0) {
	let t = [];
	Kt(t, .065, .095, .56, 6, [
		0,
		.28,
		0
	], B.bark), an(t);
	let n = Pt(e ? 3 : 2), r = new o.Vector3(0, .78, 0), i = [
		{
			at: [
				0,
				.77,
				0
			],
			r: [
				.255,
				.215,
				.24
			]
		},
		{
			at: [
				-.225,
				.72,
				.025
			],
			r: [
				.185,
				.19,
				.18
			]
		},
		{
			at: [
				.22,
				.82,
				-.02
			],
			r: [
				.195,
				.205,
				.18
			]
		},
		{
			at: [
				.012,
				.96,
				.045
			],
			r: [
				.2,
				.175,
				.19
			]
		},
		{
			at: [
				-.018,
				.7,
				-.19
			],
			r: [
				.205,
				.18,
				.19
			]
		}
	], a = n.getAttribute("position"), s = new o.Vector3();
	for (let e = 0; e < a.count; e++) {
		s.fromBufferAttribute(a, e).normalize();
		let t = 0;
		for (let e of i) {
			let n = 0, i = 0, a = -1;
			for (let t = 0; t < 3; t++) {
				let o = (r.getComponent(t) - e.at[t]) / e.r[t], c = s.getComponent(t) / e.r[t];
				n += c * c, i += 2 * c * o, a += o * o;
			}
			let o = i * i - 4 * n * a;
			if (o < 0) continue;
			let c = (-i + Math.sqrt(o)) / (2 * n);
			if (c <= 0) continue;
			let l = Math.max(0, .026 - Math.abs(t - c)) / .026;
			t = Math.max(t, c) + l * l * .0065;
		}
		let n = s.clone().multiplyScalar(t).add(r), o = Math.hypot(n.x, n.z);
		o > .43 && (n.x *= .43 / o, n.z *= .43 / o), a.setXYZ(e, n.x, n.y, n.z);
	}
	n.computeVertexNormals();
	let c = n.getAttribute("normal");
	for (let e = 0; e < c.count; e++) s.fromBufferAttribute(c, e), s.y += .22, s.normalize(), c.setXYZ(e, s.x, s.y, s.z);
	V(t, n, B.leafMid);
	let l = n.getAttribute("color"), u = new o.Color(B.leafMid), d = new o.Color(B.leafLight), f = new o.Color();
	for (let e = 0; e < a.count; e++) f.copy(u).lerp(d, o.MathUtils.smoothstep(a.getY(e), .62, 1.1) * .6), l.setXYZ(e, f.r, f.g, f.b);
	return t;
}
function sn() {
	let e = [];
	return Kt(e, .06, .09, .58, 6, [
		0,
		.29,
		0
	], B.barkLight), an(e), Jt(e, [
		-.02,
		.77,
		0
	], [
		.29,
		.25,
		.27
	], B.blossomMid, [
		0,
		.2,
		0
	], 1), Jt(e, [
		-.22,
		.72,
		.025
	], [
		.2,
		.19,
		.19
	], B.blossomDeep, [
		0,
		-.35,
		.04
	]), Jt(e, [
		.21,
		.74,
		-.03
	], [
		.21,
		.2,
		.2
	], B.blossomLight, [
		0,
		.5,
		-.04
	]), Jt(e, [
		.065,
		.92,
		.02
	], [
		.21,
		.19,
		.2
	], B.blossomLight, [
		0,
		-.2,
		0
	]), Jt(e, [
		-.11,
		.9,
		-.06
	], [
		.17,
		.16,
		.17
	], B.blossomMid, [
		0,
		.7,
		0
	]), e;
}
function cn() {
	let e = [];
	return Kt(e, .065, .095, .56, 6, [
		0,
		.28,
		0
	], B.bark), an(e), Jt(e, [
		0,
		.76,
		0
	], [
		.31,
		.27,
		.28
	], B.autumnMid, [
		0,
		.2,
		0
	], 1), Jt(e, [
		-.2,
		.72,
		.03
	], [
		.225,
		.21,
		.21
	], B.autumnDeep, [
		0,
		-.45,
		.05
	]), Jt(e, [
		.2,
		.75,
		-.025
	], [
		.23,
		.215,
		.21
	], B.autumnLight, [
		0,
		.5,
		-.04
	]), Jt(e, [
		.03,
		.91,
		.02
	], [
		.225,
		.2,
		.215
	], B.autumnLight, [
		0,
		-.2,
		0
	]), e;
}
function ln() {
	let e = Vt.assets.find((e) => e.id === "plant_flatShort"), t = new o.BufferGeometry();
	t.setAttribute("position", new o.Float32BufferAttribute(e.vertices.flatMap((e) => [
		e[0] * .36,
		e[1] * .3,
		e[2] * .36
	]), 3)), t.setIndex(e.faces.flat()), t.computeVertexNormals();
	let n = [];
	V(n, t, 6263878);
	let r = t.getAttribute("position"), i = t.getAttribute("color"), a = new o.Color(5209154), s = new o.Color(10995290), c = new o.Color();
	for (let e = 0; e < r.count; e++) c.copy(a).lerp(s, Math.min(1, Math.hypot(r.getX(e), r.getZ(e)) / .36)), i.setXYZ(e, c.r, c.g, c.b);
	return n;
}
function un() {
	let e = [];
	return V(e, $t({
		bottomCenter: [-.07, -.015],
		topCenter: [-.065, 0],
		bottomRadius: [.23, .22],
		topRadius: [.34, .29],
		bottomY: 0,
		topY: .08,
		sides: 5,
		phase: .25,
		capBottom: !0
	}), B.stoneDeep), V(e, $t({
		bottomCenter: [-.065, 0],
		topCenter: [-.08, -.025],
		bottomRadius: [.34, .29],
		topRadius: [.29, .25],
		bottomY: .08,
		topY: .42,
		sides: 5,
		phase: .25
	}), B.stoneMid), V(e, $t({
		bottomCenter: [-.08, -.025],
		topCenter: [-.11, -.03],
		bottomRadius: [.29, .25],
		topRadius: [.24, .2],
		bottomY: .42,
		topY: .5,
		sides: 5,
		phase: .25,
		capTop: !0
	}), B.stoneLight), Xt(e, [
		.27,
		.135,
		.045
	], [
		.19,
		.145,
		.17
	], B.stoneLight, [
		-.1,
		-.35,
		.08
	]), Xt(e, [
		-.32,
		.105,
		.09
	], [
		.15,
		.11,
		.13
	], B.stoneDeep, [
		.16,
		.4,
		-.08
	]), e;
}
function dn() {
	let e = [];
	V(e, tn(0, 0, .17, 1, .045, -.02, .2), B.crystalLight), V(e, tn(-.18, .035, .125, .62, -.035, .02, .7), B.crystalMid), V(e, tn(.17, .06, .115, .5, .04, .025, -.1), B.crystalDeep), V(e, tn(.03, -.15, .09, .38, -.015, -.03, .45), B.crystalGlint);
	let t = new o.Color(B.crystalGlint), n = new o.Color();
	for (let r of e) {
		let e = r.getAttribute("normal"), i = r.getAttribute("color");
		for (let r = 0; r < i.count; r++) {
			let a = o.MathUtils.clamp(e.getX(r) * .6 + e.getZ(r) * .4, 0, 1), s = Math.max(0, e.getY(r));
			n.setRGB(i.getX(r), i.getY(r), i.getZ(r)).lerp(t, a * .32 + s * .25), i.setXYZ(r, n.r, n.g, n.b);
		}
	}
	return e;
}
function fn() {
	let e = [];
	return H(e, [
		.19,
		.37,
		.2
	], [
		-.25,
		.185,
		0
	], B.ruin, [
		0,
		.04,
		.015
	]), H(e, [
		.18,
		.34,
		.19
	], [
		.25,
		.17,
		0
	], B.ruinLight, [
		0,
		-.035,
		-.012
	]), H(e, [
		.175,
		.34,
		.185
	], [
		-.245,
		.53,
		0
	], B.ruinLight, [
		.01,
		-.02,
		-.025
	]), H(e, [
		.17,
		.35,
		.185
	], [
		.245,
		.515,
		0
	], B.ruin, [
		-.015,
		.03,
		.02
	]), H(e, [
		.67,
		.17,
		.21
	], [
		0,
		.755,
		0
	], B.ruinLight, [
		.01,
		0,
		-.025
	]), H(e, [
		.22,
		.14,
		.19
	], [
		-.2,
		.91,
		.005
	], B.ruin, [
		.04,
		.08,
		.1
	]), e;
}
function pn() {
	let e = [];
	Kt(e, .205, .285, .62, 8, [
		0,
		.31,
		0
	], B.creamShade), qt(e, .305, .24, 8, [
		0,
		.74,
		0
	], B.roof), H(e, [
		.12,
		.23,
		.035
	], [
		0,
		.135,
		.272
	], B.gateDark), H(e, [
		.085,
		.105,
		.03
	], [
		-.09,
		.43,
		.225
	], B.roofLight), Kt(e, .055, .055, .12, 5, [
		0,
		.57,
		.34
	], B.gold, [
		Math.PI / 2,
		0,
		0
	]);
	for (let t = 0; t < 4; t += 1) {
		let n = Math.PI / 4 + Math.PI / 2 * t, r = .25;
		H(e, [
			.15,
			.4,
			.032
		], [
			-Math.sin(n) * r,
			.57 + Math.cos(n) * r,
			.365
		], t % 2 == 0 ? B.cream : B.creamShade, [
			0,
			0,
			n
		]), H(e, [
			.022,
			.4,
			.025
		], [
			-Math.sin(n) * r,
			.57 + Math.cos(n) * r,
			.392
		], B.barkLight, [
			0,
			0,
			n
		]);
	}
	return e;
}
function mn() {
	let e = [];
	return Kt(e, .05, .068, .72, 6, [
		-.25,
		.36,
		0
	], B.gate), Kt(e, .05, .068, .72, 6, [
		.25,
		.36,
		0
	], B.gate), H(e, [
		.76,
		.095,
		.125
	], [
		0,
		.79,
		0
	], B.gateDark, [
		0,
		0,
		-.015
	]), H(e, [
		.57,
		.07,
		.09
	], [
		0,
		.65,
		0
	], B.gate, [
		0,
		0,
		.012
	]), qt(e, .085, .1, 6, [
		-.25,
		.75,
		0
	], B.gold), qt(e, .085, .1, 6, [
		.25,
		.75,
		0
	], B.gold), e;
}
function hn() {
	let e = [];
	for (let t of [
		-.47,
		0,
		.47
	]) Kt(e, .045, .056, .45, 6, [
		t,
		.225,
		0
	], B.barkLight, [
		0,
		0,
		t * .025
	]);
	return H(e, [
		1.03,
		.075,
		.07
	], [
		0,
		.17,
		.012
	], B.barkLight, [
		0,
		0,
		.025
	]), H(e, [
		1.03,
		.075,
		.07
	], [
		0,
		.34,
		-.012
	], B.gate, [
		0,
		0,
		-.02
	]), e;
}
function gn(e, t, n) {
	return new o.Quaternion().setFromUnitVectors(new o.Vector3(0, 1, 0), new o.Vector3(e, t, n).normalize());
}
function _n(e, t, n, r, i, a) {
	let o = r - .035;
	Kt(e, .01, .014, o, 4, [
		t,
		o / 2,
		n
	], B.grassDeep);
	for (let o = 0; o < 5; o += 1) {
		let s = i + o / 5 * Math.PI * 2, c = Math.cos(s), l = Math.sin(s), u = Array.from({ length: 6 }, (e, t) => {
			let n = t * Math.PI / 3;
			return [
				Math.cos(n) * .07,
				0,
				Math.sin(n) * .041
			];
		}), d = [];
		for (let e = 0; e < u.length; e++) {
			let t = (e + 1) % u.length;
			d.push([
				[
					0,
					.016,
					0
				],
				u[t],
				u[e]
			]), d.push([
				[
					0,
					-.01,
					0
				],
				u[e],
				u[t]
			]);
		}
		V(e, Zt(d), a, {
			position: [
				t + c * .065,
				r,
				n + l * .065
			],
			rotation: [
				0,
				-s,
				0
			]
		});
	}
	V(e, Pt(0, .35), B.gold, {
		position: [
			t,
			r + .006,
			n
		],
		scale: [
			.04,
			.035,
			.04
		]
	});
}
function vn() {
	let e = [];
	return _n(e, -.12, .025, .15, .15, B.petalPink), _n(e, .13, -.025, .13, .7, B.petalCream), Jt(e, [
		-.11,
		.05,
		.025
	], [
		.09,
		.048,
		.07
	], B.grassLight), Jt(e, [
		.12,
		.045,
		-.025
	], [
		.085,
		.043,
		.07
	], B.grassMid), qt(e, .029, .115, 4, [
		-.055,
		.105,
		.015
	], B.grassLight, gn(-.9, .25, .25)), qt(e, .029, .105, 4, [
		.075,
		.085,
		-.015
	], B.grassMid, gn(.75, .3, -.35)), e;
}
function yn() {
	let e = [], t = [
		{
			x: 0,
			z: 0,
			height: .39,
			width: .095,
			bend: .035,
			turn: .1,
			color: B.grassDeep
		},
		{
			x: -.07,
			z: .015,
			height: .31,
			width: .085,
			bend: -.03,
			turn: 1.25,
			color: B.grassMid
		},
		{
			x: .07,
			z: .02,
			height: .34,
			width: .085,
			bend: .025,
			turn: 2.5,
			color: B.grassLight
		},
		{
			x: -.035,
			z: -.065,
			height: .27,
			width: .075,
			bend: .02,
			turn: 3.75,
			color: B.grassLight
		},
		{
			x: .035,
			z: -.06,
			height: .29,
			width: .078,
			bend: -.025,
			turn: 5,
			color: B.grassMid
		}
	];
	for (let n of t) V(e, nn(n.height * .62, n.width * 1.65, .032, n.bend * 2.8), n.color, {
		position: [
			n.x,
			0,
			n.z
		],
		rotation: [
			0,
			n.turn,
			0
		]
	});
	return e;
}
function bn() {
	let e = [];
	return V(e, $t({
		bottomCenter: [0, 0],
		topCenter: [.08, -.045],
		bottomRadius: [.43, .34],
		topRadius: [.185, .145],
		bottomY: 0,
		topY: .69,
		sides: 7,
		phase: .18,
		capBottom: !0
	}), B.stoneMid), V(e, en({
		center: [.08, -.045],
		radius: [.185, .145],
		bottomY: .69,
		tip: [
			.145,
			1,
			-.075
		],
		sides: 7,
		phase: .18
	}), B.snow), V(e, en({
		center: [-.285, .055],
		radius: [.18, .145],
		bottomY: 0,
		tip: [
			-.2,
			.56,
			.08
		],
		sides: 6,
		phase: .05,
		capBottom: !0
	}), B.stoneDeep), V(e, en({
		center: [.28, .09],
		radius: [.14, .12],
		bottomY: 0,
		tip: [
			.235,
			.39,
			.055
		],
		sides: 6,
		phase: .4,
		capBottom: !0
	}), B.snowShade), e;
}
function xn(e) {
	let t = Vt.assets.find((t) => t.id === (e === "leafy" ? "plant_bush" : "mushroom_tan")), n = e === "leafy" ? .38 : .28, r = e === "leafy" ? .34 : .31, i = [], a = [], s = new o.Color(5406275), c = new o.Color(10533988), l = new o.Color(14866100), u = new o.Color(12092240), d = new o.Color();
	for (let o = 0; o < t.faces.length; o++) {
		let f = t.faces[o];
		for (let p = 0; p < (e === "leafy" ? 2 : 1); p++) for (let m of p === 0 ? f : [...f].reverse()) {
			let f = t.vertices[m];
			i.push(f[0] * n, f[1] * r, f[2] * n), e === "leafy" ? d.copy(s).lerp(c, Math.min(1, Math.hypot(f[0], f[2]) * .75 + f[1] * .15)) : d.copy(t.faceMaterials?.[o] === 1 ? u : l), a.push(d.r, d.g, d.b);
		}
	}
	let f = new o.BufferGeometry();
	return f.setAttribute("position", new o.Float32BufferAttribute(i, 3)), f.setAttribute("color", new o.Float32BufferAttribute(a, 3)), f.setIndex(Array.from({ length: i.length / 3 }, (e, t) => t)), f.computeVertexNormals(), [f];
}
function Sn(e, t) {
	let n = null;
	try {
		n = ie(e, !1);
	} finally {
		for (let t of e) t.dispose();
	}
	if (!n) throw Error("Miniature asset parts must have identical indexed attributes");
	let r = n.getAttribute("position"), i = Infinity, a = -Infinity;
	for (let e = 0; e < r.count; e += 1) i = Math.min(i, r.getY(e)), a = Math.max(a, r.getY(e));
	let o = a - i;
	if (!(o > 0) || !Number.isFinite(o)) throw n.dispose(), Error("Miniature asset must have a finite positive height");
	n.translate(0, -i, 0), t && n.scale(1, 1 / o, 1);
	let s = 0;
	for (let e = 0; e < r.count; e += 1) s = Math.max(s, Math.hypot(r.getX(e), r.getZ(e)));
	return s > .7 && n.scale(.7 / s, 1, .7 / s), r.needsUpdate = !0, n.computeBoundingBox(), n.computeBoundingSphere(), n.clearGroups(), n;
}
function Cn(e) {
	throw Error(`Unknown miniature asset: ${String(e)}`);
}
function U(e, t = "world") {
	let n;
	switch (e) {
		case "fir":
			n = rn();
			break;
		case "broadleaf":
			n = on(+(t === "course"));
			break;
		case "blossom":
			n = sn();
			break;
		case "autumn":
			n = cn();
			break;
		case "stone":
			n = un();
			break;
		case "crystal":
			n = dn();
			break;
		case "ruin":
			n = fn();
			break;
		case "windmill":
			n = pn();
			break;
		case "gate":
			n = mn();
			break;
		case "fence":
			n = hn();
			break;
		case "flowers":
			n = vn();
			break;
		case "grass":
			n = yn();
			break;
		case "fern":
			n = ln();
			break;
		case "leafy":
		case "mushroom":
			n = xn(e);
			break;
		case "snowpeak":
			n = bn();
			break;
		default: return Cn(e);
	}
	return Sn(n, Ut.includes(e));
}
//#endregion
//#region src/island/course-trees.tsx
function wn({ placements: i, kind: a }) {
	let s = r(null), c = n(() => U(a, "course"), [a]), l = n(() => new o.MeshStandardMaterial({
		vertexColors: !0,
		roughness: .93,
		metalness: 0
	}), []);
	return t(() => {
		if (!s.current) return;
		let e = new o.Object3D(), t = new o.Color(), n = new o.Color(16777215);
		i.forEach((r, i) => {
			e.position.set(r.position.x, r.position.y, r.position.z), e.rotation.set(0, r.turn, 0), e.scale.setScalar(r.height), e.updateMatrix(), s.current.setMatrixAt(i, e.matrix), t.setHex(r.foliageTint ?? 16777215).lerp(n, .78), s.current.setColorAt(i, t);
		}), s.current.instanceMatrix.needsUpdate = !0, s.current.instanceColor && (s.current.instanceColor.needsUpdate = !0), s.current.computeBoundingBox(), s.current.computeBoundingSphere();
	}, [i]), e(() => () => {
		c.dispose(), l.dispose();
	}, [c, l]), i.length ? /* @__PURE__ */ (0, z.jsx)("instancedMesh", {
		ref: s,
		name: `course-${a}-trees`,
		args: [
			c,
			l,
			i.length
		],
		castShadow: !0,
		userData: {
			islandLookPlacementCount: i.length,
			islandLookTreeTotalTriangles: (c.index?.count ?? 0) / 3
		}
	}) : null;
}
var Tn = Math.PI * 2;
function En(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function Dn(e, t, n) {
	return e + (t - e) * n;
}
function On(e, t, n) {
	if (e === t) return n < e ? 0 : 1;
	let r = En((n - e) / (t - e), 0, 1);
	return r * r * (3 - 2 * r);
}
function kn(e, t) {
	let n = Math.max(0, e) / t, r = Math.floor(n);
	return (r + On(.28, .72, n - r)) * t;
}
function An(e, t) {
	return Math.hypot(e.x - t.x, e.z - t.z);
}
function jn(e, t) {
	if (e.length === 0) return 1;
	let n = (t % Tn + Tn) % Tn / Tn * e.length, r = Math.floor(n), i = r % e.length, a = (i + 1) % e.length;
	return Dn(e[i].scale, e[a].scale, n - r);
}
function Mn(e, t, n) {
	let r = (e.z - t.z) * (n.x - t.x) - (e.x - t.x) * (n.z - t.z);
	return Math.abs(r) > 1e-7 ? !1 : (e.x - t.x) * (e.x - n.x) + (e.z - t.z) * (e.z - n.z) <= 1e-7;
}
function Nn(e, t) {
	if (t.length < 3) return !1;
	let n = !1;
	for (let r = 0, i = t.length - 1; r < t.length; i = r++) {
		let a = t[r], o = t[i];
		if (Mn(e, o, a)) return !0;
		a.z > e.z != o.z > e.z && e.x < (o.x - a.x) * (e.z - a.z) / (o.z - a.z) + a.x && (n = !n);
	}
	return n;
}
function W(e, t, n) {
	if (!Number.isFinite(t) || !Number.isFinite(n)) return {
		y: 0,
		radial: Infinity,
		inside: !1
	};
	let r = t / e.bounds.halfX, i = n / e.bounds.halfZ, a = Math.atan2(i, r), o = jn(e.outline, a), s = Math.hypot(r, i) / o;
	if (!Nn({
		x: t,
		z: n
	}, e.outline)) return {
		y: 0,
		radial: s,
		inside: !1
	};
	let c = En(1 - s, 0, 1), l = En(c / .17, 0, 1), u = e.terrainPatches[0]?.phase ?? 0, d = .22 + .7 * On(-.8, .85, Math.sin(a * 2 + u) * .72 + Math.cos(a * 3 - u * .7) * .28), f = d + (1 - d) * Math.sin(l * Math.PI * .5), p = e.bounds.maxHalf, m = f * (Pn + Math.sin(r * 1.7 + u) * .1);
	for (let r of e.terrainPatches) {
		let e = An({
			x: t,
			z: n
		}, r), i = Math.exp(-1.35 * (e / r.radius) ** 2), a = .78 + .22 * Math.sin((t - r.x) * r.frequency + r.phase) * Math.cos((n - r.z) * r.frequency * .83 - r.phase);
		m += f * r.amplitude * Fn * i * a;
	}
	let h = d + (1 - d) * Math.sin(En(c / .07, 0, 1) * Math.PI * .5);
	m += h * Xn(e, t, n, p);
	let g = On(.94, .72, s) * .06;
	return m = Dn(m, kn(m, p * Ln), g), {
		y: En(m, 0, p * In),
		radial: s,
		inside: !0
	};
}
var Pn = 2.35, Fn = 3.4, In = .235, Ln = .085, Rn = .12, zn = [{
	wavelength: .48,
	amplitude: 1,
	corridor: .34,
	ridge: .14,
	turn: 0
}, {
	wavelength: .28,
	amplitude: .16,
	corridor: .58,
	ridge: .08,
	turn: .9
}];
function Bn(e) {
	return Math.max(0, 1 - e * e) ** 1.2 * 2 - 1;
}
var Vn = zn.reduce((e, t) => e + t.amplitude, 0);
function Hn(e, t, n) {
	let r = Math.floor(t), i = Math.floor(n), a = On(0, 1, t - r), o = On(0, 1, n - i), s = (t, n) => L(`${e}|${t}|${n}`);
	return Dn(Dn(s(r, i), s(r + 1, i), a), Dn(s(r, i + 1), s(r + 1, i + 1), a), o) * 2 - 1;
}
var Un = 2.6, Wn = 7.4, Gn = 1.2, Kn = 3, qn = /* @__PURE__ */ new WeakMap();
function Jn(e) {
	let t = qn.get(e);
	if (t !== void 0) return t;
	let n = e.bounds.halfX * 1.08, r = e.bounds.halfZ * 1.08, i = Math.max(2, Math.ceil(n * 2 / Gn) + 1), a = Math.max(2, Math.ceil(r * 2 / Gn) + 1), o = [];
	for (let t = 0; t < e.centerline.length; t += Kn) {
		let n = e.centerline[t];
		o.push({
			x: n.x,
			z: n.z
		});
	}
	let s = e.centerline.at(-1);
	s !== void 0 && o.push({
		x: s.x,
		z: s.z
	});
	let c = new Float32Array(i * a);
	for (let e = 0; e < a; e += 1) {
		let t = -r + e * Gn;
		for (let r = 0; r < i; r += 1) {
			let a = -n + r * Gn, s = Infinity;
			for (let e of o) {
				let n = (e.x - a) ** 2 + (e.z - t) ** 2;
				n < s && (s = n);
			}
			c[e * i + r] = Math.sqrt(s);
		}
	}
	let l = {
		cells: c,
		countX: i,
		countZ: a,
		minX: -n,
		minZ: -r,
		cell: Gn
	};
	return qn.set(e, l), l;
}
function Yn(e, t, n) {
	let r = Jn(e), i = En((t - r.minX) / r.cell, 0, r.countX - 1.0001), a = En((n - r.minZ) / r.cell, 0, r.countZ - 1.0001), o = Math.floor(i), s = Math.floor(a), c = i - o, l = a - s, u = (e, t) => r.cells[t * r.countX + e];
	return Dn(Dn(u(o, s), u(o + 1, s), c), Dn(u(o, s + 1), u(o + 1, s + 1), c), l);
}
function Xn(e, t, n, r) {
	let i = On(Un, Wn, Yn(e, t, n)), a = 0;
	for (let o = 0; o < zn.length; o += 1) {
		let s = zn[o], c = r * s.wavelength, l = Math.cos(s.turn), u = Math.sin(s.turn), d = (t * l - n * u) / c, f = (t * u + n * l) / c, p = Hn(`${e.seed}/relief/${o}`, d, f), m = s.ridge > 0 ? Dn(p, Bn(p), s.ridge) : p, h = 1 - s.corridor * (1 - i);
		a += m * s.amplitude * h;
	}
	return a / Vn * r * Rn;
}
//#endregion
//#region src/island/coast-profile.ts
function Zn(e, t) {
	return .62 * Math.sin(t + e) + .18 * Math.sin(t * 3 - e * .61) + .36 * Math.sin(t * 7 + e * .83);
}
function Qn(e, t, n) {
	let r = Math.max(0, Math.min(1, (n - e) / (t - e)));
	return r * r * (3 - 2 * r);
}
function $n(e, t, n, r, i) {
	if (r < .74) return 0;
	let a = Math.atan2(n / e.bounds.halfZ, t / e.bounds.halfX), o = Qn(.32, -.7, Zn(L(`${e.seed}/cliff-root`) * Math.PI * 2, a)), s = .5 + .5 * Qn(.015, .075, i / e.bounds.maxHalf);
	return Qn(.91 - o * .17, .995, r) * o * s;
}
var er = 8, tr = 512, nr = 4, rr = 8, ir = 8, ar = Math.PI * 2, or = {
	route: 0,
	grass: 1,
	shore: 2,
	rock: 3
};
function sr(e) {
	return Math.min(1, Math.max(0, e));
}
function cr(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function lr(e, t, n) {
	if (e === t) return n < e ? 0 : 1;
	let r = sr((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}
function ur(e, t, n) {
	return e + (t - e) * n;
}
function dr(e) {
	let t = e ?? 192;
	if (!Number.isInteger(t) || t < er || t > tr) throw RangeError(`IslandField resolution must be an integer from ${er} to ${tr}`);
	return t;
}
function fr(e) {
	return Math.round(sr(e) * 255);
}
function pr(e, t, n) {
	return cr((e + t) / (t * 2) * (n - 1), 0, n - 1);
}
function mr(e, t, n, r) {
	let i = t / r, a = n / r, o = Math.floor(i), s = Math.floor(a), c = lr(0, 1, i - o), l = lr(0, 1, a - s), u = (t, n) => L(`${e}/${o + t}/${s + n}`);
	return ur(ur(u(0, 0), u(1, 0), c), ur(u(0, 1), u(1, 1), c), l);
}
function hr(e, t, n, r) {
	let i = cr(n, 0, t - 1), a = cr(r, 0, t - 1), o = Math.floor(i), s = Math.floor(a), c = Math.min(t - 1, o + 1), l = Math.min(t - 1, s + 1), u = i - o, d = a - s;
	return ur(ur(e[s * t + o], e[s * t + c], u), ur(e[l * t + o], e[l * t + c], u), d);
}
function gr(e, t, n, r, i) {
	let a = cr(r, 0, t - 1), o = cr(i, 0, t - 1), s = Math.floor(a), c = Math.floor(o), l = Math.min(t - 1, s + 1), u = Math.min(t - 1, c + 1), d = a - s, f = o - c, p = (r, i) => e[(i * t + r) * nr + n] / 255;
	return ur(ur(p(s, c), p(l, c), d), ur(p(s, u), p(l, u), d), f);
}
function _r(e, t, n, r) {
	e[t * nr + n] = fr(r);
}
function vr(e, t = {}) {
	let n = dr(t.resolution), r = Math.max(1, e.bounds.maxHalf), i = r * 2 / (n - 1), a = n * n, o = new Float32Array(a), s = new Float32Array(a), c = new Uint8Array(a), l = new Float32Array(a), u = new Float32Array(a), d = new Uint8Array(a * nr), f = new Uint8Array(a), p = Infinity, m = -Infinity;
	for (let t = 0; t < n; t += 1) {
		let a = -r + t * i;
		for (let l = 0; l < n; l += 1) {
			let u = -r + l * i, d = t * n + l, f = W(e, u, a);
			f.inside && (o[d] = f.y, s[d] = sr(f.radial), c[d] = 1, f.radial <= .9 && (p = Math.min(p, f.y), m = Math.max(m, f.y)));
		}
	}
	(!Number.isFinite(p) || !Number.isFinite(m)) && (p = 0, m = 1);
	let h = Math.max(m - p, 2 ** -52);
	for (let e = 0; e < n; e += 1) for (let t = 0; t < n; t += 1) {
		let r = e * n + t;
		if (c[r] === 0) continue;
		let a = (hr(o, n, t + 1, e) - hr(o, n, t - 1, e)) / (2 * i), s = (hr(o, n, t, e + 1) - hr(o, n, t, e - 1)) / (2 * i);
		l[r] = sr(Math.atan(Math.hypot(a, s)) / (Math.PI / 2));
	}
	for (let e = 0; e < n; e += 1) for (let t = 0; t < n; t += 1) {
		let r = e * n + t;
		if (c[r] === 0) {
			f[r] = 255, u[r] = 1;
			continue;
		}
		let a = 0;
		for (let s = 0; s < rr; s += 1) {
			let c = s / rr * ar, l = Math.cos(c), u = Math.sin(c);
			for (let s = 1; s <= ir; s += 1) {
				let c = s * i, d = hr(o, n, t + l * s, e + u * s);
				a = Math.max(a, Math.atan2(d - o[r], c));
			}
		}
		let s = 1 - lr(.03, .72, a) * .58;
		u[r] = s, f[r] = fr(s);
	}
	for (let t = 0; t < n; t += 1) {
		let a = -r + t * i;
		for (let f = 0; f < n; f += 1) {
			let m = -r + f * i, g = t * n + f, _ = c[g] === 1, v = _ ? s[g] : 1, y = Yn(e, m, a), b = e.route.roadWidth / 2 + e.route.shoulderWidth, x = 1 - lr(b, b + 1.1, y), S = _ ? $n(e, m, a, v, o[g]) : 0, C = Math.max(l[g], S), w = 1 - lr(.2, .8, _ ? sr((o[g] - p) / h) : 1), T = lr(.1, .46, C), E = lr(.76, .96, v), D = _ ? mr(`${e.seed}/island-field/grass`, m, a, Math.max(14, e.bounds.maxHalf * .34)) : 0, O = _ ? .46 + w * .42 - T * .55 + (D - .5) * .1 + (1 - u[g]) * .08 - E * .08 - S * .5 : 0, k = _ ? v : 1;
			_r(d, g, or.route, x), _r(d, g, or.grass, O), _r(d, g, or.shore, k), _r(d, g, or.rock, C);
		}
	}
	return {
		resolution: n,
		extent: r,
		height: o,
		mask: d,
		ao: f
	};
}
var yr = /* @__PURE__ */ new WeakMap();
function br(e, t = {}) {
	let n = dr(t.resolution), r = yr.get(e) ?? /* @__PURE__ */ new Map(), i = r.get(n);
	if (i !== void 0) return i;
	let a = vr(e, { resolution: n });
	return r.set(n, a), yr.set(e, r), a;
}
function xr(e, t, n, r) {
	return !Number.isFinite(n) || !Number.isFinite(r) ? 0 : gr(e.mask, e.resolution, or[t], pr(n, e.extent, e.resolution), pr(r, e.extent, e.resolution));
}
function G(e, t, n) {
	if (!Number.isFinite(t) || !Number.isFinite(n)) return {
		height: 0,
		route: 0,
		grass: 0,
		shore: 1,
		rock: 0,
		ao: 1,
		inside: !1
	};
	let r = pr(t, e.extent, e.resolution), i = pr(n, e.extent, e.resolution), a = (t) => gr(e.mask, e.resolution, or[t], r, i), o = a("shore");
	return {
		height: hr(e.height, e.resolution, r, i),
		route: a("route"),
		grass: a("grass"),
		shore: o,
		rock: a("rock"),
		ao: Sr(e.ao, e.resolution, r, i),
		inside: o < .995
	};
}
function Sr(e, t, n, r) {
	let i = cr(n, 0, t - 1), a = cr(r, 0, t - 1), o = Math.floor(i), s = Math.floor(a), c = Math.min(t - 1, o + 1), l = Math.min(t - 1, s + 1), u = i - o, d = a - s, f = (n, r) => e[r * t + n] / 255;
	return ur(ur(f(o, s), f(c, s), u), ur(f(o, l), f(c, l), u), d);
}
//#endregion
//#region src/island/stone-joints.ts
var Cr = Math.PI * 2;
function wr(e, t, n) {
	if (!Number.isInteger(t) || t < 32 || t % 32 != 0) throw RangeError("Stone contours require a multiple of 32 sectors");
	let r = t / 32, i = n === 2 ? r : 0, a = [];
	for (let o = 0; o < 8; o++) {
		let s = L(`${e}/${o}/${n}/stone-width`), c = s < .3 ? 1 : s > .7 ? 3 : 2, l = o * 4 * r + i;
		for (let [i, s] of [c * r, (4 - c) * r].entries()) a.push({
			start: l % t,
			width: s,
			character: L(`${e}/${o}/${i}/${n}/stone-face`)
		}), l += s;
	}
	return a;
}
function Tr(e, t, n) {
	let r = Math.floor(L(`${e}/stone-strike`) * 8), i = (t / Cr * 8 + r + 8) % 8, a = Math.floor(i), o = i - a, s = Math.max(0, 1 - Math.min(o, 1 - o) / .24), c = L(`${e}/${a}/stone-seat`), l = L(`${e}/${(a + 1) % 8}/stone-seat`), u = i * 2 % 16, d = Math.floor(u), f = u - d, p = L(`${e}/${d}/${n}/mineral-break`), m = (p + (L(`${e}/${(d + 1) % 16}/${n}/mineral-break`) - p) * f) * .8 + (c + (l - c) * o) * .2;
	return {
		block: a,
		recess: s,
		gather: (n === 1 ? 0 : n === 2 ? .11 : n === 3 ? .085 : .025) * (s - .3),
		drop: n === 2 ? (m - .5) * .2 : n === 3 ? (m - .5) * .1 : 0,
		mineral: .82 + L(`${e}/${a}/stone-mineral`) * .23
	};
}
//#endregion
//#region src/island/cliff-panels.ts
function Er(e, t) {
	let n = e.map((e) => e.x), r = e.map((e) => e.y), i = [
		{
			x: Math.min(...n),
			y: Math.min(...r)
		},
		{
			x: Math.max(...n),
			y: Math.min(...r)
		},
		{
			x: Math.max(...n),
			y: Math.max(...r)
		},
		{
			x: Math.min(...n),
			y: Math.max(...r)
		}
	];
	for (let t = 0; t < e.length; t++) {
		let n = e[t], r = e[(t + 1) % e.length], a = (e) => (r.x - n.x) * (e.y - n.y) - (r.y - n.y) * (e.x - n.x), o = [];
		for (let e = 0; e < i.length; e++) {
			let t = i[e], n = i[(e + 1) % i.length], r = a(t), s = a(n), c = r <= 1e-12, l = s <= 1e-12;
			if (c && o.push(t), c !== l) {
				let e = r / (r - s);
				o.push({
					x: t.x + (n.x - t.x) * e,
					y: t.y + (n.y - t.y) * e
				});
			}
		}
		i = o;
	}
	if (i.length < 3) return null;
	let a = i[Math.min(i.length - 1, Math.floor(t * i.length))], o = .32;
	return {
		x: i.reduce((e, t) => e + t.x, 0) / i.length * .6799999999999999 + a.x * o,
		y: i.reduce((e, t) => e + t.y, 0) / i.length * .6799999999999999 + a.y * o
	};
}
function Dr(e, t, n, r, i, a, s, c, l, u, d = .5) {
	let f = e.map((e) => new o.Vector3(e.x, e.y, e.z)), p = f.reduce((e, t) => e.add(t), new o.Vector3()).divideScalar(f.length), m = new o.Vector3();
	for (let e = 0; e < f.length; e++) m.add(f[e].clone().sub(p).cross(f[(e + 1) % f.length].clone().sub(p)));
	m.normalize();
	let h = new o.Vector3(p.x - s.x, 0, p.z - s.z).normalize(), g = new o.Vector3(m.x, 0, m.z).normalize(), _ = h.lerp(g, .18).normalize(), v = o.MathUtils.clamp(m.y + (d - .5) * .16, -.72, .4);
	m.set(_.x * Math.sqrt(1 - v * v), v, _.z * Math.sqrt(1 - v * v));
	let y = f[0].distanceTo(f[f.length / 2 - 1]), b = y * (.025 + d * .035), x = p.clone().addScaledVector(m, b), S = Math.atan2(p.z - s.z, p.x - s.x), C = m.dot(x), w = f.map((e) => {
		let t = Math.atan2(e.z - s.z, e.x - s.x) - S;
		return {
			x: Math.atan2(Math.sin(t), Math.cos(t)),
			y: e.y
		};
	}), T = w.slice(0, w.length / 2), E = w.slice(w.length / 2).reverse(), D = (Math.max(T[0].x, E[0].x) + Math.min(T[T.length - 1].x, E[E.length - 1].x)) / 2, O = (e, t) => {
		for (let n = 0; n < e.length - 1; n++) {
			let r = e[n], i = e[n + 1];
			if (t > i.x && n < e.length - 2) continue;
			let a = o.MathUtils.clamp((t - r.x) / (i.x - r.x), 0, 1);
			return r.y + (i.y - r.y) * a;
		}
		return e[e.length - 1].y;
	}, k = (e) => {
		let t = S + e.x, n = e.y, r = Math.cos(t), i = Math.sin(t), a = (C - m.y * n - m.x * s.x - m.z * s.z) / (m.x * r + m.z * i);
		return new o.Vector3(s.x + r * a, n, s.z + i * a);
	}, A = new o.Vector3(-m.z, 0, m.x).normalize(), j = A.clone().cross(m).normalize(), M = (e, t, r) => {
		let i = t.x - e.x, a = t.y - e.y, o = t.z - e.z, c = r.x - e.x, l = r.y - e.y, u = a * (r.z - e.z) - o * l, d = i * l - a * c, f = (e.x + t.x + r.x) / 3 - s.x, p = (e.z + t.z + r.z) / 3 - s.z;
		return (u * f + d * p) / Math.hypot(f, p) > 1e-7 / (n * n);
	}, N = [], P = x.clone(), F = !1, ee = Math.max(...w.map((e) => e.x)) - Math.min(...w.map((e) => e.x)) > Math.PI / 7 && e.length > 4;
	for (let e = 0; e < 6 && !F && !ee; e++) {
		let t = .08 + d * .035 + e * .06;
		N = w.map((n, r) => {
			let i = D + (n.x - D) * (.89 - d * .05 - e * .035), a = O(T, i), o = O(E, i), s = w.length / 2, c = (r < s ? r : w.length - 1 - r) / (s - 1), l = r < s, u = l ? .055 + d * .18 : .2 - d * .12, f = l ? .17 - d * .11 : .075 + d * .13, p = Math.abs(c * 2 - 1) ** 3 * (u * (1 - c) + f * c), m = Math.min(.44, t + p);
			return k({
				x: i,
				y: r < w.length / 2 ? a * (1 - m) + o * m : o * (1 - m) + a * m
			});
		});
		let n = Er(N.map((e) => {
			let t = e.clone().sub(x);
			return {
				x: t.dot(A),
				y: t.dot(j)
			};
		}), d);
		n && (P = x.clone().addScaledVector(A, n.x).addScaledVector(j, n.y).addScaledVector(m, y * (.01 + d * .015)), F = f.every((e, t) => {
			let n = (t + 1) % f.length;
			return M(e, f[n], N[t]) && M(f[n], N[n], N[t]) && M(N[t], N[n], P);
		}));
	}
	let te = t.clone().multiplyScalar(.87), ne = (e, t, o, s) => {
		let c = r.length / 3;
		for (let [a, c] of [
			e,
			t,
			o
		].entries()) r.push(c.x * n, c.y * n, c.z * n), i.push(s[a].r, s[a].g, s[a].b);
		return a.push(c, c + 1, c + 2), c;
	};
	if (!F) {
		let o = e.length / 2;
		if (o > 2) {
			l.divided++;
			let f = Math.floor((o - 1) / 2), p = Array(e.length);
			for (let [m, h] of [[0, f], [f, o - 1]]) {
				let o = [...Array.from({ length: h - m + 1 }, (e, t) => m + t), ...Array.from({ length: h - m + 1 }, (t, n) => e.length - 1 - h + n)], f = Dr(o.map((t) => e[t]), t, n, r, i, a, s, c, l, u, d);
				o.forEach((e, t) => {
					p[e] = f[t];
				});
			}
			return p;
		}
		if (!M(f[0], f[1], f[3]) || !M(f[1], f[2], f[3])) throw Error("Invalid source cliff winding");
		l.plain++;
		let p = ne(f[0], f[1], f[3], [
			t,
			t,
			t
		]), m = ne(f[1], f[2], f[3], [
			t,
			t,
			t
		]);
		return [
			p,
			p + 1,
			m + 1,
			p + 2
		];
	}
	l.bevelled++;
	let re = [];
	for (let e = 0; e < f.length; e++) {
		let n = (e + 1) % f.length;
		e < f.length / 2 - 1 && c.push(a.length, a.length + 3);
		let r = e < f.length / 2 - 1, i = r && u ? u : te, o = r && u ? t.clone().lerp(u, d < .4 ? .46 : .18) : t;
		re.push(ne(f[e], f[n], N[e], [
			i,
			i,
			o
		])), ne(f[n], N[n], N[e], [
			i,
			o,
			o
		]), ne(N[e], N[n], P, [
			t,
			t,
			t
		]);
	}
	return re;
}
//#endregion
//#region src/island/miniature-style.ts
var Or = {
	garden: {
		id: "garden",
		tree: "fir",
		focal: "fence",
		water: null,
		flowers: !0,
		meadow: 9881679,
		shade: 7381574
	},
	lagoon: {
		id: "lagoon",
		tree: "broadleaf",
		focal: "fence",
		water: "pond",
		flowers: !0,
		meadow: 11062624,
		shade: 7906123
	},
	crystal: {
		id: "crystal",
		tree: "fir",
		focal: "crystal",
		water: null,
		flowers: !1,
		meadow: 11523434,
		shade: 8234584
	},
	windmill: {
		id: "windmill",
		tree: "fir",
		focal: "windmill",
		water: null,
		flowers: !0,
		meadow: 11850346,
		shade: 9153100
	},
	grove: {
		id: "grove",
		tree: "fir",
		focal: "stone",
		water: "cascade",
		flowers: !0,
		meadow: 10734172,
		shade: 7774537
	},
	autumn: {
		id: "autumn",
		tree: "autumn",
		focal: "stone",
		water: null,
		flowers: !1,
		meadow: 15058026,
		shade: 12821338
	},
	ruins: {
		id: "ruins",
		tree: "fir",
		focal: "ruin",
		water: null,
		flowers: !1,
		meadow: 11520375,
		shade: 8625493
	},
	alpine: {
		id: "alpine",
		tree: "fir",
		focal: "snowpeak",
		water: null,
		flowers: !1,
		meadow: 14806237,
		shade: 10798530
	},
	blossom: {
		id: "blossom",
		tree: "blossom",
		focal: "gate",
		water: null,
		flowers: !0,
		meadow: 12113013,
		shade: 9416018
	}
}, kr = {
	"R01-forest-academy": "garden",
	"R02-river-market": "lagoon",
	"R03-starport": "crystal",
	"R04-orbital-lab": "windmill",
	"R05-border-observatory": "crystal",
	"R06-forest-fortress": "grove",
	"R07-training-arena": "autumn",
	"R08-ancient-cavern": "ruins",
	"R09-grave-cavern": "ruins",
	"R10-bay-harbour": "lagoon",
	"R11-snow-camp": "alpine",
	"R12-garden-sports": "blossom"
};
function Ar(e) {
	return Or[kr[e.themeSelection.recipeId ?? ""] ?? "garden"];
}
//#endregion
//#region src/island/surface-clip.ts
function jr(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) {
		let r = e[n], i = e[(n + 1) % e.length];
		t += r.x * i.z - i.x * r.z;
	}
	return t;
}
function Mr(e) {
	return jr(e) > 0 ? [...e].reverse() : e;
}
function Nr(e, t, n) {
	let r = (e.z1 - e.z2) * (e.x0 - e.x2) + (e.x2 - e.x1) * (e.z0 - e.z2);
	if (Math.abs(r) < 1e-12) return null;
	let i = ((e.z1 - e.z2) * (t - e.x2) + (e.x2 - e.x1) * (n - e.z2)) / r, a = ((e.z2 - e.z0) * (t - e.x2) + (e.x0 - e.x2) * (n - e.z2)) / r;
	return [
		i,
		a,
		1 - i - a
	];
}
function Pr(e, t, n, r, i, a) {
	return (n - e) * (a - t) - (r - t) * (i - e);
}
function Fr(e, t) {
	let n = Mr([
		{
			x: t.x0,
			z: t.z0
		},
		{
			x: t.x1,
			z: t.z1
		},
		{
			x: t.x2,
			z: t.z2
		}
	]), r = Mr(e);
	for (let e = 0; e < n.length && r.length > 0; e += 1) {
		let t = n[e], i = n[(e + 1) % n.length], a = r, o = [];
		for (let e = 0; e < a.length; e += 1) {
			let n = a[e], r = a[(e + 1) % a.length], s = Pr(t.x, t.z, i.x, i.z, n.x, n.z), c = Pr(t.x, t.z, i.x, i.z, r.x, r.z), l = s <= 0, u = c <= 0;
			if (l && o.push(n), l !== u) {
				let e = s - c;
				if (Math.abs(e) > 1e-15) {
					let t = s / e;
					o.push({
						x: n.x + (r.x - n.x) * t,
						z: n.z + (r.z - n.z) * t
					});
				}
			}
		}
		r = o;
	}
	return r;
}
function Ir(e, t) {
	let n = Math.max(.001, t), r = /* @__PURE__ */ new Map(), i = (e, t) => `${e}:${t}`, a = (e) => ({
		minX: Math.min(e.x0, e.x1, e.x2),
		maxX: Math.max(e.x0, e.x1, e.x2),
		minZ: Math.min(e.z0, e.z1, e.z2),
		maxZ: Math.max(e.z0, e.z1, e.z2)
	});
	return e.forEach((e, t) => {
		let o = a(e), s = Math.floor(o.minX / n), c = Math.floor(o.maxX / n), l = Math.floor(o.minZ / n), u = Math.floor(o.maxZ / n);
		for (let e = s; e <= c; e += 1) for (let n = l; n <= u; n += 1) {
			let a = i(e, n), o = r.get(a);
			o ? o.push(t) : r.set(a, [t]);
		}
	}), {
		triangles: e,
		candidates(e, t, a, o) {
			let s = [], c = /* @__PURE__ */ new Set(), l = Math.floor(e / n), u = Math.floor(a / n), d = Math.floor(t / n), f = Math.floor(o / n);
			for (let e = l; e <= u; e += 1) for (let t = d; t <= f; t += 1) {
				let n = r.get(i(e, t));
				if (n) for (let e of n) c.has(e) || (c.add(e), s.push(e));
			}
			return s;
		}
	};
}
//#endregion
//#region src/grid/grid-palette.ts
var Lr = {
	shadow: 4270628,
	cliff: 7357743,
	rim: 11044700,
	road: 15787463
};
function Rr(e, t, n) {
	let r = n;
	return r < 0 && (r += 1), r > 1 && --r, r < 1 / 6 ? e + (t - e) * 6 * r : r < 1 / 2 ? t : r < 2 / 3 ? e + (t - e) * (2 / 3 - r) * 6 : e;
}
function zr(e, t = !1) {
	let n = (e >> 16 & 255) / 255, r = (e >> 8 & 255) / 255, i = (e & 255) / 255, a = Math.max(n, r, i), o = Math.min(n, r, i), s = (a + o) * .5, c = a - o, l = 0, u = 0;
	c > 0 && (u = c / (1 - Math.abs(2 * s - 1)), l = a === n ? (r - i) / c % 6 : a === r ? (i - n) / c + 2 : (n - r) / c + 4, l /= 6, l < 0 && (l += 1));
	let d = Math.max(.12, Math.min(.36, s * .38)), f = Math.max(.28, Math.min(.76, u * .78)), p = d < .5 ? d * (1 + f) : d + f - d * f, m = 2 * d - p, h = c === 0 ? [
		d,
		d,
		d
	] : [
		Rr(m, p, l + 1 / 3),
		Rr(m, p, l),
		Rr(m, p, l - 1 / 3)
	], g = [
		(Lr.cliff >> 16 & 255) / 255,
		(Lr.cliff >> 8 & 255) / 255,
		(Lr.cliff & 255) / 255
	], _ = t ? .62 : 1, v = h.map((e, t) => (e * .78 + g[t] * .22) * _);
	return Math.round(Math.min(1, v[0]) * 255) << 16 | Math.round(Math.min(1, v[1]) * 255) << 8 | Math.round(Math.min(1, v[2]) * 255);
}
var K = {
	amberLight: 16768140,
	coralLight: 16751202,
	coral: 15956312,
	coralDeep: 14436908,
	brick: 12593176
};
K.coral, K.coralLight, K.coralLight, K.coral, K.coralDeep, K.brick, K.coral, K.amberLight;
var Br = [
	{
		id: "morning-meadow",
		top: 12629040,
		accent: K.coralDeep,
		...Lr
	},
	{
		id: "cool-highland",
		top: 7260569,
		accent: K.coralDeep,
		...Lr
	},
	{
		id: "autumn-grove",
		top: 14193728,
		accent: K.coralDeep,
		...Lr
	},
	{
		id: "mint-shelf",
		top: 7262120,
		accent: K.coralDeep,
		...Lr
	},
	{
		id: "dusk-field",
		top: 9940032,
		accent: K.amberLight,
		...Lr
	},
	{
		id: "deep-forest",
		top: 3974208,
		accent: K.amberLight,
		...Lr
	},
	{
		id: "sand-bar",
		top: 14207102,
		accent: K.coral,
		...Lr
	},
	{
		id: "clay-terrace",
		top: 13400926,
		accent: K.amberLight,
		...Lr
	},
	{
		id: "tundra-flat",
		top: 10928471,
		accent: K.coralDeep,
		...Lr
	},
	{
		id: "spring-rise",
		top: 6864204,
		accent: K.coralDeep,
		...Lr
	}
];
function Vr(e, t, n) {
	return Math.floor(L(`${e}/${t}/${n}/palette-slot`) * Br.length);
}
function Hr(e, t, n) {
	let r = Br[Vr(e, t, n)];
	return {
		top: r.top,
		shadow: r.shadow,
		cliff: r.cliff,
		rim: r.rim,
		road: r.road,
		accent: r.accent
	};
}
//#endregion
//#region src/island/island-geometry.ts
function Ur(e, t, n) {
	return n ? n / e.bounds.maxHalf : t === "world" ? 1 / e.bounds.maxHalf : 1;
}
var Wr = new o.Color(9420363), Gr = new o.Color(14217099), Kr = new o.Color(4549432), qr = new o.Color(12701533), Jr = new o.Color(10337356), Yr = new o.Color(4022584), Xr = new o.Color(12631913), Zr = new o.Color(15389862), Qr = new o.Color(11041104), $r = new o.Color(7358772), ei = new o.Color(11576719), ti = new o.Color(7630707), ni = new o.Color(11187645), ri = new o.Color(8556703), ii = new o.Color(6110514), ai = new o.Color(11635288), oi = new o.Color(14006392), si = new o.Color(8609855), ci = new o.Color(13743225);
function li(e) {
	return zr(Hr(e.studyId, e.courseId, e.seed).top);
}
function ui(e, t) {
	return e === "course" ? t.length : Math.min(32, Math.max(16, t.length));
}
var di = 52, fi = Array.from({ length: di }, (e, t) => (t + 1) / di), pi = [
	.16,
	.34,
	.52,
	.68,
	.84,
	1
];
function mi(e) {
	return e === "course" ? fi : pi;
}
function hi(e, t, n) {
	let r = t / n * e.length, i = Math.floor(r) % e.length, a = (i + 1) % e.length, o = r - Math.floor(r), s = e[i], c = e[a];
	return {
		angle: s.angle + (c.angle - s.angle) * o,
		scale: s.scale + (c.scale - s.scale) * o,
		x: s.x + (c.x - s.x) * o,
		z: s.z + (c.z - s.z) * o
	};
}
var gi = /* @__PURE__ */ new WeakMap();
function _i(e, t) {
	let n = gi.get(e);
	n || (n = /* @__PURE__ */ new Map(), gi.set(e, n));
	let r = n.get(t);
	if (r) return r;
	let i = ui(t, e.outline), a = mi(t), o = {
		x: 0,
		z: 0,
		y: W(e, 0, 0).y
	}, s = [];
	for (let t = 0; t < a.length; t += 1) {
		let n = a[t], r = [];
		for (let t = 0; t < i; t += 1) {
			let a = hi(e.outline, t, i), o = a.x * n, s = a.z * n;
			r.push({
				x: o,
				z: s,
				y: W(e, o, s).y
			});
		}
		s.push(r);
	}
	return r = {
		segments: i,
		center: o,
		rings: s
	}, n.set(t, r), r;
}
function vi(e, t, n, r) {
	let i = (n.z - r.z) * (t.x - r.x) + (r.x - n.x) * (t.z - r.z);
	if (Math.abs(i) < 1e-8) return null;
	let a = ((n.z - r.z) * (e.x - r.x) + (r.x - n.x) * (e.z - r.z)) / i, o = ((r.z - t.z) * (e.x - r.x) + (t.x - r.x) * (e.z - r.z)) / i, s = 1 - a - o;
	return a < -1e-5 || o < -1e-5 || s < -1e-5 ? null : t.y * a + n.y * o + r.y * s;
}
function yi(e, t) {
	let n = _i(e, t);
	if (n.surfaceIndex) return n.surfaceIndex;
	let r = [], i = new Map([n.center, ...n.rings.flat()].map((e, t) => [e, t])), a = (e, t, n) => {
		r.push({
			x0: e.x,
			y0: e.y,
			z0: e.z,
			x1: t.x,
			y1: t.y,
			z1: t.z,
			x2: n.x,
			y2: n.y,
			z2: n.z,
			i0: i.get(e),
			i1: i.get(t),
			i2: i.get(n)
		});
	};
	for (let e = 0; e < n.rings.length; e++) {
		let t = n.rings[e];
		for (let r = 0; r < n.segments; r++) {
			let i = (r + 1) % n.segments;
			if (e === 0) a(n.center, t[i], t[r]);
			else {
				let o = n.rings[e - 1];
				a(o[r], o[i], t[r]), a(o[i], t[i], t[r]);
			}
		}
	}
	return n.surfaceIndex = Ir(r, Math.max(.5, e.bounds.maxHalf * .06)), n.surfaceIndex;
}
function bi(e, t, n = "course") {
	if (t.length < 3 || t.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.z))) return null;
	let r = Math.abs(jr(t)) / 2;
	if (r <= 1e-9) return null;
	let i = yi(e, n), a = t.map((e) => e.x), o = t.map((e) => e.z), s = 0, c = Infinity, l = -Infinity, u = 0;
	for (let e of i.candidates(Math.min(...a), Math.min(...o), Math.max(...a), Math.max(...o))) {
		let n = i.triangles[e], r = Fr(t, n), a = Math.abs(jr(r)) / 2;
		if (a <= 1e-10) continue;
		s += a;
		for (let e of r) {
			let t = Nr(n, e.x, e.z);
			if (!t) return null;
			let r = t[0] * n.y0 + t[1] * n.y1 + t[2] * n.y2;
			c = Math.min(c, r), l = Math.max(l, r);
		}
		let o = n.x1 - n.x0, d = n.y1 - n.y0, f = n.z1 - n.z0, p = n.x2 - n.x0, m = n.y2 - n.y0, h = n.z2 - n.z0, g = f * p - o * h;
		u = Math.max(u, Math.hypot(d * h - f * m, o * m - d * p) / Math.abs(g));
	}
	return Number.isFinite(c + l + u) && Math.abs(s - r) <= Math.max(1e-7, r * 1e-5) ? {
		minY: c,
		maxY: l,
		maxSlope: u
	} : null;
}
function q(e, t, n, r) {
	let i = W(e, n, r);
	if (!i.inside) return i;
	let a = _i(e, t), o = a.segments, s = mi(t), c = n / e.bounds.halfX, l = r / e.bounds.halfZ, u = (Math.atan2(l, c) + Math.PI * 2) % (Math.PI * 2), d = Math.min(o - 1, Math.floor(u / (Math.PI * 2) * o)), f = i.radial, p = (e, t, i) => vi({
		x: n,
		z: r
	}, e, t, i), m = (e, t) => {
		let n = (t + o) % o, r = (n + 1) % o, i = a.rings[e];
		if (e === 0) return p(a.center, i[n], i[r]);
		let s = a.rings[e - 1], c = s[n], l = s[r], u = i[n], d = i[r];
		return p(c, l, u) ?? p(l, d, u);
	}, h = 0;
	if (f > s[0]) {
		h = s.length - 1;
		for (let e = 1; e < s.length; e += 1) if (f <= s[e]) {
			h = e;
			break;
		}
	}
	let g = [
		0,
		-1,
		1
	], _ = [
		0,
		-1,
		1,
		-2,
		2,
		-3,
		3
	], v = null;
	for (let e of g) {
		let t = h + e;
		if (!(t < 0 || t >= s.length)) {
			for (let e of _) if (v = m(t, d + e), v !== null) break;
			if (v !== null) break;
		}
	}
	if (v === null) for (let e of g) {
		let t = h + e;
		if (!(t < 0 || t >= s.length)) {
			for (let e = 0; e < o && v === null; e += 1) v = m(t, e);
			if (v !== null) break;
		}
	}
	return {
		...i,
		y: v ?? i.y
	};
}
function xi(e, t, n, r) {
	let i = ui(t, e.outline), a = mi(t).length, o = e.bounds.maxHalf / a, s = Math.PI * 2 * Math.hypot(n, r) / i;
	return Math.max(o, s);
}
function Si(e, t, n, r, i, a) {
	let s = e.seed, c = e.bounds.maxHalf;
	if (t === "world") {
		let t = Ar(e), s = Ci(a / Math.max(.001, c * .18));
		return new o.Color(t.shade).lerp(new o.Color(t.meadow), .56 + s * .4).lerp(new o.Color(12764594), $n(e, n, r, i, a) * .22);
	}
	let l = Ci(a / Math.max(1e-6, c * .155)), u = xi(e, t, n, r), d = W(e, n + u, r), f = W(e, n - u, r), p = W(e, n, r + u), m = W(e, n, r - u), h = d.inside ? d.y : a, g = f.inside ? f.y : a, _ = p.inside ? p.y : a, v = m.inside ? m.y : a, y = h - g, b = _ - v, x = Math.hypot(y, b) / (2 * u), S = (a - (h + g + _ + v) / 4) / u, C = L(`${s}/terrain-colour`) * Math.PI * 2, w = Math.max(5, c * .12), T = (Math.sin(n / w + C) + Math.cos(r / (w * 1.21) - C * .7) + Math.sin((n + r) / (w * 2.03) + C * .31)) / 3, E = Wr.clone();
	E.lerp(Jr, J(.2, .02, l) * .5), E.lerp(Yr, J(.15, 0, l) * .3), E.lerp(Xr, J(.55, 1, l) * .6), T > .2 && E.lerp(qr, Math.min(.6, T)), T < -.18 && E.lerp(Kr, Math.min(.5, -T)), E.lerp(Yr, J(.2, .78, x) * .5);
	let D = J(.87, 1.73, x);
	if (D > 0) {
		let e = Qr.clone().lerp($r, J(1.2, 2.2, x));
		E.lerp(e, D * .9);
	}
	let O = J(.34, .86, x) * (1 - D), k = J(.88, .995, i);
	O > 0 && k > 0 && E.lerp(Zr, O * k * .32);
	let A = J(0, -.55, S), j = J(.05, .6, S);
	return E.multiplyScalar(1 - A * .26 + j * .1), E.lerp(ni, $n(e, n, r, i, a) * .72), E;
}
function Ci(e) {
	return Math.min(1, Math.max(0, e));
}
function J(e, t, n) {
	if (e === t) return n < e ? 0 : 1;
	let r = Ci((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}
function wi(e, t) {
	e.push(t.r, t.g, t.b);
}
function Ti(e) {
	return e * e * (3 - 2 * e);
}
function Ei(e, t, n) {
	let r = Math.floor(n), i = Ti(n - r), a = L(`${e}/dirt-path/${t}/${r}`);
	return a + (L(`${e}/dirt-path/${t}/${r + 1}`) - a) * i;
}
function Di(e, t, n, r, i) {
	let a = n <= 1 ? 0 : t / (n - 1), o = L(`${e.seed}/dirt-path/broad-phase`) * Math.PI * 2, s = .5 + Math.sin(a * Math.PI * 4.6 + o) * .5, c = Ei(e.seed, `width-${i}`, t / 3.2);
	return r * (.66 + s * .22 + c * .38);
}
function Oi(e, t, n, r, i, a, o) {
	let s = Ei(e.seed, "colour-shared", t / 3.4) * .72 + Ei(e.seed, `colour-${n}`, t / 4.8) * .28, c = Si(e, "course", r, i, a, o).multiplyScalar(.86 + s * .12);
	return c.lerp(ci, .78), s < .5 && c.lerp(si, .14), s > .72 && c.lerp(oi, .14), c;
}
function ki(e, t, n) {
	if (W(e, n.x, n.z).inside) return {
		point: n,
		sample: q(e, "course", n.x, n.z)
	};
	let r = 0, i = 1, a = t, o = q(e, "course", t.x, t.z);
	for (let s = 0; s < 12; s += 1) {
		let s = (r + i) * .5, c = {
			x: t.x + (n.x - t.x) * s,
			z: t.z + (n.z - t.z) * s
		};
		W(e, c.x, c.z).inside ? (r = s, a = c, o = q(e, "course", c.x, c.z)) : i = s;
	}
	return {
		point: a,
		sample: o
	};
}
var Ai = .002, ji = 1e-9;
function Mi(e, t) {
	let n = e.centerline, r = e.route.roadWidth / 2 + e.route.shoulderWidth, i = n[t], a = n[Math.max(0, t - 1)], o = n[Math.min(n.length - 1, t + 1)], s = o.x - a.x, c = o.z - a.z, l = Math.hypot(s, c) || 1, u = -c / l, d = s / l, f = Di(e, t, n.length, r, "left"), p = Di(e, t, n.length, r, "right");
	return [
		{
			across: f,
			side: "left",
			outer: !0
		},
		{
			across: f * .62,
			side: "left",
			outer: !1
		},
		{
			across: -p * .62,
			side: "right",
			outer: !1
		},
		{
			across: -p,
			side: "right",
			outer: !0
		}
	].map(({ across: n, side: r, outer: a }) => {
		let o = ki(e, i, {
			x: i.x + u * n,
			z: i.z + d * n
		}), s = o.sample, c = Oi(e, t, r, o.point.x, o.point.z, s.radial, s.y), l = a ? Si(e, "course", o.point.x, o.point.z, s.radial, s.y).lerp(c, .22) : c;
		return {
			x: o.point.x,
			z: o.point.z,
			colour: l
		};
	});
}
function Ni(e, t) {
	return new o.Color(e[0].r * t[0] + e[1].r * t[1] + e[2].r * t[2], e[0].g * t[0] + e[1].g * t[1] + e[2].g * t[2], e[0].b * t[0] + e[1].b * t[1] + e[2].b * t[2]);
}
function Pi(e, t) {
	let n = [];
	for (let r of e) {
		let e = n[n.length - 1];
		e && Math.abs(e.x - r.x) < t && Math.abs(e.z - r.z) < t || n.push(r);
	}
	let r = n[0], i = n[n.length - 1];
	return n.length > 2 && r && i && Math.abs(r.x - i.x) < t && Math.abs(r.z - i.z) < t && n.pop(), n;
}
function Fi(e, t, n, r, i, a, o, s) {
	let c = Math.min(e.x0, e.x1, e.x2), l = Math.max(e.x0, e.x1, e.x2), u = Math.min(e.z0, e.z1, e.z2), d = Math.max(e.z0, e.z1, e.z2), f = [
		{
			x: e.x0,
			z: e.z0
		},
		{
			x: e.x1,
			z: e.z1
		},
		{
			x: e.x2,
			z: e.z2
		}
	], p = Math.max(1e-7, (l - c + d - u) * 1e-6), m = 0;
	for (let h of n.candidates(c, u, l, d)) {
		let c = n.triangles[h], l = Fr(f, c);
		if (l.length < 3) continue;
		let u = Pi(Mr(l), p);
		if (u.length < 3 || Math.abs(jr(u)) < ji) continue;
		let d = i.length / 3, g = [], _ = !0;
		for (let n of u) {
			let o = Nr(c, n.x, n.z), s = Nr(e, n.x, n.z);
			if (o === null || s === null) {
				_ = !1;
				break;
			}
			let l = c.y0 * o[0] + c.y1 * o[1] + c.y2 * o[2];
			g.push({
				vertex: d + g.length,
				ground: [
					c.i0,
					c.i1,
					c.i2
				],
				weights: o
			}), i.push(n.x * r, (l + Ai) * r, n.z * r), wi(a, Ni(t, s));
		}
		if (!_) {
			i.length = d * 3, a.length = d * 3;
			continue;
		}
		s.push(...g);
		for (let e = 1; e + 1 < u.length; e += 1) o.push(d, d + e, d + e + 1), m += 1;
	}
	return m;
}
function Ii(e, t) {
	if (t.length === 0) return;
	let n = e.getAttribute("normal"), r = n.array;
	for (let e of t) {
		let t = 0, n = 0, i = 0;
		for (let a = 0; a < 3; a += 1) {
			let o = e.ground[a] * 3, s = e.weights[a];
			t += r[o] * s, n += r[o + 1] * s, i += r[o + 2] * s;
		}
		let a = Math.hypot(t, n, i), o = e.vertex * 3;
		if (a < 1e-9) {
			r[o] = 0, r[o + 1] = 1, r[o + 2] = 0;
			continue;
		}
		r[o] = t / a, r[o + 1] = n / a, r[o + 2] = i / a;
	}
	n.needsUpdate = !0;
}
function Li(e) {
	let t = e.centerline;
	if (t.length < 2) return [];
	let n = [], r = Mi(e, 0);
	for (let i = 1; i < t.length; i += 1) {
		let t = Mi(e, i);
		for (let e = 0; e < 3; e += 1) {
			let i = r[e], a = r[e + 1], o = t[e], s = t[e + 1], c = [[
				i,
				o,
				a
			], [
				a,
				o,
				s
			]];
			for (let [e, t, r] of c) n.push({
				ribbon: {
					x0: e.x,
					z0: e.z,
					y0: 0,
					i0: -1,
					x1: t.x,
					z1: t.z,
					y1: 0,
					i1: -1,
					x2: r.x,
					z2: r.z,
					y2: 0,
					i2: -1
				},
				colours: [
					e.colour,
					t.colour,
					r.colour
				]
			});
		}
		r = t;
	}
	return n;
}
function Ri(e, t, n, r, i, a, o) {
	let s = 0;
	for (let { ribbon: c, colours: l } of Li(e)) s += Fi(c, l, a, t, n, r, i, o);
	return s;
}
function zi(e, t, n, r, i, a, o) {
	let s = W(n, i, a);
	e.push(i * o, s.y * o, a * o), wi(t, Si(n, r, i, a, s.radial, s.y));
}
function Bi(e, t, n, r) {
	let i = r === 0 ? 1 : 1 / r, a = [];
	for (let r = 0; r < n; r += 1) {
		let n = t[r * 3], o = t[r * 3 + 1], s = t[r * 3 + 2], c = n * 3, l = o * 3, u = s * 3;
		a.push({
			x0: e[c] * i,
			y0: e[c + 1] * i,
			z0: e[c + 2] * i,
			i0: n,
			x1: e[l] * i,
			y1: e[l + 1] * i,
			z1: e[l + 2] * i,
			i1: o,
			x2: e[u] * i,
			y2: e[u + 1] * i,
			z2: e[u + 2] * i,
			i2: s
		});
	}
	return a;
}
function Vi(e, t, n) {
	let r = Ci((.86 - t) * .4), i = n === "course" ? Math.min(.42, e * .018) : e * .1;
	return [
		{
			gather: 0,
			yOffset: 0,
			sky: 1,
			gatherVary: 0,
			depthVary: 0,
			cant: 0
		},
		{
			gather: .02,
			yOffset: -i,
			sky: n === "course" ? .985 : .955,
			gatherVary: .008,
			depthVary: n === "course" ? i / e * .12 : .014,
			cant: 0
		},
		{
			gather: .13,
			yOffset: -e * .34,
			sky: .64,
			gatherVary: .09,
			depthVary: .13,
			cant: .0015
		},
		{
			gather: .39 + r,
			yOffset: -e * .73,
			sky: .4,
			gatherVary: .075,
			depthVary: .075,
			cant: .006
		},
		{
			gather: .76 + r * 1.1,
			yOffset: -e * .95,
			sky: .22,
			gatherVary: .075,
			depthVary: .025,
			cant: .008
		}
	];
}
function Hi(e, t, n) {
	return Zn(e, t / n * Math.PI * 2);
}
function Ui(e, t, n) {
	let r = 0, i = 0, a = Infinity;
	for (let n = 0; n < t; n += 1) {
		let o = hi(e.outline, n, t), s = Math.hypot(o.x, o.z);
		a = Math.min(a, s), r += o.x * s, i += o.z * s;
	}
	let o = Math.hypot(r, i), s = Math.min(e.bounds.maxHalf * .12, Math.max(0, a) * .28), c = o > 1e-8 ? {
		x: r / o * s,
		z: i / o * s
	} : {
		x: Math.cos(n) * s,
		z: Math.sin(n) * s
	}, l = 1;
	for (let n = 0; n < t; n += 1) {
		let r = hi(e.outline, n, t), i = hi(e.outline, (n + 1) % t, t), a = i.x - r.x, o = i.z - r.z, s = o * r.x - a * r.z, u = a * c.z - o * c.x;
		u < 0 && (l = Math.min(l, s * .95 / -u));
	}
	return {
		x: c.x * l,
		z: c.z * l
	};
}
function Wi(e, t, n, r, i, a) {
	let s = Ci(1 - n.sky);
	if (a === "world") {
		if (s < .08) return e.clone().multiplyScalar(1 - s * .9);
		let t = new o.Color(11450563).lerp(new o.Color(8556704), s * .72).multiplyScalar(.94 - r * .15);
		return e.clone().lerp(t, J(0, .18 - i * .08, s));
	}
	if (s < .08) return e.clone().multiplyScalar(1 - s * .6);
	let c = ni.clone().lerp(Zr, J(.34, 0, s) * .08).lerp(ri, J(.08, .92, s) * .46).lerp(t, .025 + s * .035), l = Ci(.5 + r * .45);
	return c.lerp(ai, l * .035), c.multiplyScalar(Ci(.88 + n.sky * .1 - r * .1)), e.clone().lerp(c, J(0, .06 - i * .018, s));
}
function Gi(e, t, n, r) {
	let i = e.length / 3;
	return e.push(n.x * r, n.y * r, n.z * r), wi(t, n.colour), i;
}
function Ki(e, t, n, r) {
	let i = new o.Vector3(e.getX(n) - e.getX(t), e.getY(n) - e.getY(t), e.getZ(n) - e.getZ(t)), a = new o.Vector3(e.getX(r) - e.getX(t), e.getY(r) - e.getY(t), e.getZ(r) - e.getZ(t));
	return i.cross(a);
}
function qi(e, t, n, r) {
	if (t.length === 0) return;
	let i = e.getAttribute("position"), a = e.getAttribute("normal"), s = t.map((e) => {
		if (e.kind === "bottom") return new o.Vector3(0, -1, 0);
		let [t, n, r, a, s, c] = e.vertices;
		return Ki(i, t, n, r).add(Ki(i, a, s, c)).normalize();
	});
	for (let [e, o] of t.entries()) {
		if (o.kind === "bottom") {
			for (let e of o.vertices) a.setXYZ(e, 0, -1, 0);
			continue;
		}
		let [c, l, u, d, f, p] = o.vertices, m = s[e], h = e >= n ? s[e - n] : m, g = t[e + n]?.kind === "side" ? s[e + n] : m, _ = m.clone().add(h).normalize(), v = m.clone().add(g).normalize();
		for (let t of [[
			c,
			l,
			u
		], [
			d,
			f,
			p
		]]) {
			let o = Ki(i, ...t).normalize();
			for (let i of t) {
				let t = [
					c,
					l,
					d
				].includes(i) ? _ : v, s = o.dot(m) > .82 ? m : o, u = e < n ? .55 : 0, f = o.clone().lerp(s, e < n ? 0 : .8).multiplyScalar(1 - u).addScaledVector(t, u).normalize();
				r === "world" && e < n && (f.y += 1.15, f.normalize()), a.setXYZ(i, f.x, f.y, f.z);
			}
		}
	}
	a.needsUpdate = !0;
}
function Ji(e, t, n, r, i) {
	let a = e.getAttribute("normal");
	for (let e = 0; e < n; e++) {
		let s = t[e], c = t[(e + n - 1) % n];
		if (s.kind !== "side" || c.kind !== "side") continue;
		let l = r + e, u = new o.Vector3().fromBufferAttribute(a, l), d = [
			s.vertices[0],
			c.vertices[1],
			c.vertices[3]
		], f = d.reduce((e, t) => e.add(new o.Vector3().fromBufferAttribute(a, t)), new o.Vector3()).normalize(), p = u.clone().add(f).normalize(), m = (1 - i[e]) * J(.3, .85, u.dot(f)), h = u.lerp(p, m).normalize();
		a.setXYZ(l, h.x, h.y, h.z);
		for (let e of d) {
			let t = new o.Vector3().fromBufferAttribute(a, e).lerp(p, m).normalize();
			a.setXYZ(e, t.x, t.y, t.z);
		}
	}
	let s = e.getAttribute("position");
	for (let e of t.slice(0, n)) if (e.kind === "side") for (let t of [e.vertices.slice(0, 3), e.vertices.slice(3, 6)]) {
		let e = Ki(s, t[0], t[1], t[2]).normalize();
		for (let n of t) new o.Vector3().fromBufferAttribute(a, n).dot(e) < Math.cos(Math.PI / 3) && a.setXYZ(n, e.x, e.y, e.z);
	}
}
function Yi(e, t, n, r) {
	let i = ui(t, e.outline), a = mi(t), s = [], c = [], l = [], u = W(e, 0, 0);
	s.push(0, u.y * n, 0), wi(c, Si(e, t, 0, 0, u.radial, u.y));
	for (let r = 0; r < a.length; r += 1) {
		let o = a[r];
		for (let r = 0; r < i; r += 1) {
			let a = hi(e.outline, r, i);
			zi(s, c, e, t, a.x * o, a.z * o, n);
		}
	}
	for (let e = 0; e < i; e += 1) {
		let t = (e + 1) % i;
		l.push(0, 1 + t, 1 + e);
	}
	for (let e = 0; e < a.length - 1; e += 1) {
		let t = 1 + e * i, n = t + i;
		for (let e = 0; e < i; e += 1) {
			let r = (e + 1) % i;
			l.push(t + e, t + r, n + e), l.push(t + r, n + r, n + e);
		}
	}
	let d = l.length / 3, f = 0, p = [];
	if (t === "course") {
		let t = Math.max(.5, e.bounds.maxHalf * .06);
		f = Ri(e, n, s, c, l, Ir(Bi(s, l, d, n), t), p);
	}
	let m = new o.Color(li(e)), h = L(`${e.seed}/cliff-root`) * Math.PI * 2, g = Ui(e, i, h), _ = Vi(r, e.underside.taper, t), v = 1 + (a.length - 1) * i, y = [], b = Array.from({ length: i }, (n, r) => {
		let a = hi(e.outline, r, i), o = W(e, a.x, a.z);
		return {
			point: a,
			sample: o,
			lobe: Hi(h, r, i),
			ground: Si(e, t, a.x, a.z, o.radial, o.y)
		};
	}), x = b.map(({ point: t, sample: n }) => $n(e, t.x, t.z, n.radial, n.y));
	for (let a = 0; a < _.length; a += 1) {
		let o = _[a], c = [];
		for (let l = 0; l < i; l += 1) {
			let { point: u, sample: d, lobe: f, ground: p } = b[l], h = u.x, _ = d.y, y = u.z;
			if (a === 0) {
				let e = (v + l) * 3;
				h = s[e] / n, _ = s[e + 1] / n, y = s[e + 2] / n;
			} else {
				let t = Tr(e.seed, l / i * Math.PI * 2, a), n = Math.hypot(u.x, u.z) || 1, s = o.gather >= .3 ? (Ci(n / e.bounds.maxHalf) - .72) * .12 : 0, c = 1 - Ci(o.gather + f * o.gatherVary - s + t.gather), p = f * o.cant, m = Math.cos(p), v = Math.sin(p), b = u.x - g.x, x = u.z - g.z;
				h = g.x + c * (b * m - x * v), y = g.z + c * (b * v + x * m), _ = d.y + o.yOffset + r * (o.depthVary * f + t.drop);
			}
			c.push({
				x: h,
				y: _,
				z: y,
				colour: Wi(p, m, o, f, x[l], t)
			});
		}
		y.push(c);
	}
	let S = [], C = _.map(() => Array(i).fill(-1));
	for (let e = 0; e < 1; e += 1) {
		let t = y[e], r = y[e + 1];
		for (let a = 0; a < i; a += 1) {
			let o = (a + 1) % i, u = Gi(s, c, t[a], n), d = Gi(s, c, t[o], n), f = Gi(s, c, r[a], n), p = Gi(s, c, t[o], n), m = Gi(s, c, r[o], n), h = Gi(s, c, r[a], n);
			C[e][a] = u, C[e + 1][a] = f;
			let g = [
				u,
				d,
				f
			], _ = [
				p,
				m,
				h
			];
			l.push(...g), l.push(..._), S.push({
				kind: "side",
				vertices: [
					g[0],
					g[1],
					g[2],
					_[0],
					_[1],
					_[2]
				]
			});
		}
	}
	let w = [], T = {
		bevelled: 0,
		divided: 0,
		plain: 0
	};
	for (let t = 1; t < _.length - 1; t++) for (let [r, a] of wr(e.seed, i, t).entries()) {
		let { start: u, width: d, character: f } = a, p = [...Array.from({ length: d + 1 }, (e, n) => ({
			ring: t,
			sector: (u + n) % i
		})), ...Array.from({ length: d + 1 }, (e, n) => ({
			ring: t + 1,
			sector: (u + d - n) % i
		}))], m = p.map((e) => y[e.ring][e.sector]), h = .83 + L(`${e.seed}/${r}/${t}/panel-mineral`) * .23, _ = new o.Color(9150127).lerp(new o.Color(12104357), .12 + L(`${e.seed}/${r}/panel-warmth`) * .32).multiplyScalar(h * (1 - (t - 1) * .14)), v = Dr(m, _, n, s, c, l, g, w, T, t === 1 ? y[0][u].colour.clone().lerp(_, .35 + x[u] * .4) : void 0, f);
		p.forEach((e, t) => {
			C[e.ring][e.sector] = v[t];
		});
	}
	let E = l.length, D = ei.clone().lerp(ti, .72).lerp(si, .24).lerp(m, .23).multiplyScalar(.9), O = Gi(s, c, {
		x: g.x,
		y: -r * 1.08,
		z: g.z,
		colour: D
	}, n), k = y[_.length - 1];
	for (let e = 0; e < i; e += 1) {
		let t = (e + 1) % i, r = Gi(s, c, k[e], n), a = Gi(s, c, k[t], n);
		l.push(O, r, a), S.push({
			kind: "bottom",
			vertices: [
				O,
				r,
				a
			]
		});
	}
	let A = new o.BufferGeometry();
	A.userData.cliffTopology = {
		ringIndices: C,
		bottomIndex: O,
		bottomStart: E,
		panelCount: 16,
		gardenFaces: w,
		panelStats: T
	}, A.userData.miniatureSurfaceVertexEnd = 1 + a.length * i + i * 6, A.setAttribute("position", new o.Float32BufferAttribute(s, 3)), A.setAttribute("color", new o.Float32BufferAttribute(c, 3)), A.setIndex(l), A.computeVertexNormals(), qi(A, S, i, t), Ji(A, S, i, v, x), Ii(A, p), A.computeBoundingBox(), A.computeBoundingSphere();
	let j = l.length / 3;
	return {
		geometry: A,
		counts: {
			topTriangles: d,
			routeTriangles: f,
			cliffTriangles: j - d - f,
			total: j
		}
	};
}
function Xi(e, t, n) {
	let r = Ur(e, t, n), i = e.underside.depth, a = Yi(e, t, r, i), s = a.geometry.boundingBox?.min.y ?? 0;
	return {
		terrain: a.geometry,
		bounds: {
			halfX: e.bounds.halfX * r,
			halfZ: e.bounds.halfZ * r,
			depth: Math.max(0, -s)
		},
		counts: a.counts,
		scale: r,
		point: (t, n) => {
			let i = W(e, t, n);
			return new o.Vector3(t * r, i.y * r, n * r);
		}
	};
}
Math.cos(38 * Math.PI / 180), Wr.getHex(), Gr.getHex(), Kr.getHex(), Jr.getHex(), Yr.getHex(), Xr.getHex(), Zr.getHex(), Qr.getHex(), $r.getHex(), ei.getHex(), ii.getHex(), ai.getHex(), oi.getHex(), si.getHex(), ci.getHex();
//#endregion
//#region src/island/island-route-geometry.ts
function Zi(e, t, n) {
	let r = n.x - t.x, i = n.z - t.z, a = r * r + i * i, o = a <= 2 ** -52 ? 0 : Math.max(0, Math.min(1, ((e.x - t.x) * r + (e.z - t.z) * i) / a));
	return Math.hypot(e.x - (t.x + r * o), e.z - (t.z + i * o));
}
function Y(e, t) {
	let n = Infinity;
	for (let r = 1; r < e.centerline.length; r += 1) n = Math.min(n, Zi(t, e.centerline[r - 1], e.centerline[r]));
	return n;
}
function Qi(e) {
	return e.route.roadWidth / 2 + e.route.shoulderWidth + e.route.clearance;
}
function $i(e, t) {
	return e.centerline.length === 0 ? null : ea(e, Math.min(e.centerline.length - 1, Math.max(0, Math.round(t * (e.centerline.length - 1)))));
}
function ea(e, t) {
	if (e.centerline.length === 0) return null;
	let n = Math.min(e.centerline.length - 1, Math.max(0, t)), r = e.centerline[n], i = e.centerline[Math.max(0, n - 2)] ?? r, a = e.centerline[Math.min(e.centerline.length - 1, n + 2)] ?? r, o = a.x - i.x, s = a.z - i.z, c = Math.hypot(o, s) || 1, l = {
		x: o / c,
		z: s / c
	};
	return {
		point: {
			x: r.x,
			z: r.z
		},
		tangent: l,
		baseNormal: {
			x: -l.z,
			z: l.x
		}
	};
}
function ta(e, t) {
	if (e.centerline.length === 0) return null;
	let n = 0, r = Infinity;
	return e.centerline.forEach((e, i) => {
		let a = Math.hypot(e.x - t.x, e.z - t.z);
		a < r && (r = a, n = i);
	}), n;
}
function na(e, t, n) {
	let r = t < 0 ? -1 : 1;
	return {
		point: {
			x: e.point.x + e.baseNormal.x * n * r,
			z: e.point.z + e.baseNormal.z * n * r
		},
		tangent: e.tangent,
		normal: r < 0 ? {
			x: -e.baseNormal.x,
			z: -e.baseNormal.z
		} : e.baseNormal
	};
}
function ra(e) {
	return {
		x: Math.sin(e),
		z: Math.cos(e)
	};
}
function ia(e) {
	let t = Math.hypot(e.x, e.z) || 1;
	return Math.atan2(-e.z / t, e.x / t);
}
function aa(e) {
	let t = Math.hypot(e.x, e.z) || 1;
	return Math.atan2(e.x / t, e.z / t);
}
//#endregion
//#region src/island/course-rock-profile.ts
var oa = new Map({
	schemaVersion: 1,
	license: "CC0-1.0",
	author: "Kenney (www.kenney.nl)",
	sourceUrl: "https://kenney.nl/assets/nature-kit",
	licenseSha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
	roles: [
		"rock",
		"grass",
		"underside"
	],
	assets: [
		{
			set: "boulder",
			id: "rock_tallA",
			source: "kenney_nature-kit/Models/GLTF format/rock_tallA.glb",
			sha256: "88250f236a3b75f8b55c1d8afb6af020f8a91b1e81f9fb51f7ef513420d45a2d",
			size: [
				.983,
				.996,
				.683
			],
			positions: [
				.038,
				.092,
				-.179,
				.089,
				.092,
				-.209,
				.075,
				.151,
				-.153,
				.107,
				.151,
				-.172,
				.034,
				.679,
				.231,
				.011,
				.996,
				.215,
				-.031,
				.679,
				.003,
				-.043,
				.996,
				.027,
				.191,
				.151,
				-.049,
				.232,
				.151,
				-.029,
				.178,
				.323,
				-.021,
				.224,
				.323,
				0,
				-.013,
				0,
				-.216,
				.204,
				0,
				-.342,
				.204,
				.092,
				-.275,
				.167,
				.486,
				.177,
				-.049,
				.486,
				.301,
				.136,
				.679,
				.172,
				-.049,
				.679,
				.279,
				.434,
				.092,
				.123,
				.397,
				.151,
				.107,
				.434,
				.092,
				.047,
				.397,
				.151,
				.044,
				.204,
				0,
				.322,
				.094,
				0,
				.259,
				.204,
				.092,
				.256,
				.145,
				.092,
				.222,
				-.283,
				.231,
				-.083,
				-.322,
				.231,
				-.122,
				-.205,
				0,
				-.147,
				-.311,
				0,
				-.253,
				-.425,
				0,
				.107,
				-.492,
				0,
				-.124,
				-.35,
				.231,
				.007,
				-.376,
				.231,
				-.084,
				.492,
				0,
				.156,
				.492,
				0,
				-.176,
				.434,
				.092,
				-.142,
				-.049,
				0,
				-.237,
				-.049,
				.486,
				-.197,
				.191,
				.151,
				-.086,
				.167,
				.486,
				-.072,
				-.265,
				.486,
				.177,
				-.235,
				.679,
				.172,
				.339,
				.323,
				.095,
				.339,
				.323,
				.051,
				-.235,
				.679,
				.065,
				-.212,
				.996,
				.078,
				.222,
				.092,
				.047,
				.219,
				.151,
				.044,
				.254,
				.092,
				-.127,
				.246,
				.151,
				-.103,
				-.049,
				0,
				.342,
				-.3,
				0,
				.197,
				-.265,
				.486,
				-.072,
				-.028,
				.486,
				-.019,
				.167,
				.486,
				.052,
				.136,
				.679,
				.065,
				.214,
				.323,
				.051,
				.173,
				.151,
				.201,
				.185,
				.229,
				.187,
				-.265,
				.486,
				.052,
				.178,
				.323,
				.159,
				.204,
				.151,
				.219,
				-.212,
				.996,
				.166,
				.204,
				.323,
				.173,
				-.3,
				0,
				.107,
				-.283,
				.231,
				.007,
				-.058,
				.996,
				.255
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				6,
				5,
				4,
				5,
				6,
				7,
				10,
				9,
				8,
				9,
				10,
				11,
				0,
				13,
				12,
				13,
				0,
				14,
				14,
				0,
				1,
				17,
				16,
				15,
				16,
				17,
				18,
				18,
				17,
				4,
				21,
				20,
				19,
				20,
				21,
				22,
				25,
				24,
				23,
				24,
				25,
				26,
				29,
				28,
				27,
				28,
				29,
				30,
				33,
				32,
				31,
				32,
				33,
				34,
				36,
				19,
				35,
				19,
				36,
				21,
				21,
				36,
				37,
				39,
				12,
				38,
				12,
				39,
				0,
				0,
				39,
				2,
				2,
				39,
				40,
				40,
				39,
				41,
				18,
				42,
				16,
				42,
				18,
				43,
				22,
				44,
				20,
				44,
				22,
				45,
				47,
				6,
				46,
				6,
				47,
				7,
				50,
				49,
				48,
				49,
				50,
				9,
				9,
				50,
				51,
				16,
				53,
				52,
				53,
				16,
				42,
				39,
				27,
				54,
				38,
				27,
				39,
				27,
				38,
				29,
				6,
				56,
				55,
				56,
				6,
				57,
				58,
				22,
				49,
				22,
				58,
				45,
				26,
				52,
				24,
				52,
				26,
				16,
				16,
				26,
				59,
				16,
				59,
				60,
				16,
				60,
				15,
				34,
				30,
				32,
				30,
				34,
				28,
				43,
				61,
				42,
				61,
				43,
				46,
				19,
				23,
				35,
				23,
				19,
				25,
				46,
				55,
				61,
				55,
				46,
				6,
				62,
				15,
				60,
				15,
				62,
				56,
				56,
				62,
				10,
				56,
				10,
				41,
				41,
				10,
				8,
				41,
				8,
				40,
				63,
				26,
				25,
				26,
				63,
				59,
				14,
				36,
				13,
				36,
				14,
				37,
				64,
				46,
				43,
				46,
				64,
				47,
				56,
				17,
				15,
				17,
				56,
				57,
				44,
				63,
				20,
				63,
				44,
				65,
				42,
				66,
				53,
				66,
				42,
				61,
				66,
				61,
				67,
				67,
				61,
				54,
				67,
				54,
				27,
				68,
				43,
				18,
				43,
				68,
				64,
				20,
				25,
				19,
				25,
				20,
				63,
				3,
				50,
				1,
				50,
				3,
				51,
				67,
				31,
				66,
				31,
				67,
				33,
				5,
				18,
				4,
				18,
				5,
				68,
				65,
				59,
				63,
				59,
				65,
				60,
				60,
				65,
				62,
				49,
				11,
				58,
				11,
				49,
				9,
				49,
				21,
				48,
				21,
				49,
				22,
				4,
				57,
				6,
				57,
				4,
				17,
				55,
				54,
				61,
				54,
				55,
				39,
				39,
				55,
				41,
				41,
				55,
				56,
				44,
				58,
				65,
				58,
				44,
				45,
				10,
				65,
				58,
				65,
				10,
				62,
				10,
				58,
				11,
				68,
				47,
				64,
				47,
				68,
				7,
				7,
				68,
				5,
				33,
				28,
				34,
				28,
				33,
				67,
				28,
				67,
				27,
				21,
				50,
				48,
				37,
				50,
				21,
				14,
				50,
				37,
				50,
				14,
				1,
				9,
				40,
				8,
				51,
				40,
				9,
				3,
				40,
				51,
				40,
				3,
				2,
				30,
				31,
				32,
				31,
				30,
				66,
				66,
				30,
				29,
				66,
				29,
				53,
				53,
				29,
				52,
				52,
				29,
				38,
				52,
				38,
				12,
				52,
				12,
				24,
				24,
				12,
				13,
				24,
				13,
				23,
				23,
				13,
				36,
				23,
				36,
				35
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2
			]
		},
		{
			set: "boulder",
			id: "rock_tallB",
			source: "kenney_nature-kit/Models/GLTF format/rock_tallB.glb",
			sha256: "b3fb7899c317a3b026fa6ced0e1eaaa596d9dd0d95efeacfb5e05d25322f19b9",
			size: [
				.765,
				.884,
				.77
			],
			positions: [
				.192,
				.321,
				-.078,
				.219,
				.321,
				-.078,
				.206,
				.453,
				-.05,
				.235,
				.453,
				-.05,
				.269,
				.197,
				-.104,
				-.117,
				0,
				.377,
				-.294,
				0,
				.377,
				-.135,
				.173,
				.337,
				-.276,
				.173,
				.337,
				-.267,
				.61,
				.03,
				-.327,
				0,
				.03,
				-.162,
				.61,
				-.153,
				-.309,
				0,
				0,
				-.228,
				.248,
				-.098,
				-.179,
				.248,
				-.183,
				-.012,
				.61,
				.164,
				-.028,
				.884,
				.136,
				.049,
				.61,
				.059,
				.016,
				.884,
				.059,
				-.134,
				.61,
				-.047,
				-.012,
				.61,
				-.047,
				-.117,
				.884,
				-.018,
				-.028,
				.884,
				-.018,
				-.155,
				.173,
				.291,
				-.256,
				.173,
				.291,
				-.165,
				.368,
				.27,
				-.246,
				.368,
				.27,
				-.287,
				.368,
				.178,
				-.307,
				.173,
				.178,
				-.252,
				.368,
				.098,
				-.271,
				.173,
				.097,
				.29,
				0,
				.246,
				.112,
				0,
				.385,
				.206,
				.177,
				.19,
				.091,
				.177,
				.28,
				.17,
				.453,
				.03,
				.155,
				.61,
				.03,
				.159,
				.453,
				.011,
				.05,
				.61,
				-.153,
				.152,
				.321,
				-.025,
				.064,
				.321,
				-.177,
				.382,
				0,
				.151,
				.31,
				0,
				.171,
				.287,
				.453,
				.079,
				.215,
				.177,
				.16,
				.153,
				.177,
				.178,
				.145,
				.453,
				.12,
				-.023,
				0,
				-.353,
				.221,
				0,
				-.353,
				.021,
				.321,
				-.277,
				.177,
				.321,
				-.277,
				.071,
				.177,
				.249,
				.058,
				.177,
				.249,
				.05,
				.61,
				.213,
				-.148,
				.368,
				.233,
				-.173,
				.368,
				.233,
				-.162,
				.61,
				.213,
				-.137,
				.173,
				.25,
				-.096,
				.173,
				.25,
				-.036,
				0,
				.264,
				-.067,
				0,
				.264,
				.344,
				0,
				-.141,
				.256,
				.321,
				-.141,
				-.134,
				.61,
				.164,
				-.194,
				.61,
				.059,
				-.117,
				.884,
				.136,
				-.162,
				.884,
				.059,
				.382,
				0,
				.035,
				.287,
				.453,
				.057,
				-.36,
				0,
				-.084,
				-.234,
				.248,
				-.107,
				-.309,
				0,
				-.361,
				-.207,
				.248,
				-.251,
				.112,
				.177,
				.178,
				.118,
				.453,
				.12,
				-.294,
				.173,
				.058,
				-.321,
				0,
				.04,
				-.125,
				.248,
				-.183,
				-.152,
				.248,
				-.256,
				-.076,
				.147,
				-.192,
				-.045,
				0,
				-.315,
				-.071,
				0,
				-.385,
				.318,
				0,
				-.097,
				-.037,
				.321,
				-.177,
				-.02,
				0,
				.35,
				.063,
				.177,
				.273,
				-.382,
				0,
				.178,
				-.347,
				.173,
				.178
			],
			indices: [
				2,
				1,
				0,
				3,
				1,
				2,
				1,
				3,
				4,
				7,
				6,
				5,
				6,
				7,
				8,
				11,
				10,
				9,
				10,
				11,
				12,
				12,
				11,
				13,
				13,
				11,
				14,
				17,
				16,
				15,
				16,
				17,
				18,
				21,
				20,
				19,
				20,
				21,
				22,
				25,
				24,
				23,
				24,
				25,
				26,
				29,
				28,
				27,
				28,
				29,
				30,
				33,
				32,
				31,
				32,
				33,
				34,
				37,
				36,
				35,
				36,
				37,
				38,
				38,
				37,
				39,
				38,
				39,
				40,
				43,
				42,
				41,
				42,
				43,
				44,
				44,
				43,
				45,
				45,
				43,
				46,
				49,
				48,
				47,
				48,
				49,
				50,
				53,
				52,
				51,
				52,
				53,
				54,
				54,
				53,
				55,
				55,
				53,
				56,
				57,
				52,
				54,
				58,
				52,
				57,
				58,
				59,
				52,
				59,
				58,
				60,
				48,
				62,
				61,
				62,
				48,
				50,
				65,
				64,
				63,
				64,
				65,
				66,
				67,
				43,
				41,
				43,
				67,
				68,
				13,
				69,
				12,
				69,
				13,
				70,
				21,
				64,
				66,
				64,
				21,
				19,
				70,
				71,
				69,
				71,
				70,
				72,
				46,
				73,
				45,
				73,
				46,
				74,
				56,
				29,
				55,
				29,
				56,
				9,
				29,
				9,
				30,
				30,
				9,
				75,
				75,
				9,
				76,
				76,
				9,
				10,
				73,
				53,
				51,
				53,
				73,
				74,
				53,
				74,
				36,
				36,
				74,
				35,
				26,
				28,
				24,
				28,
				26,
				27,
				79,
				78,
				77,
				78,
				79,
				80,
				78,
				80,
				81,
				16,
				63,
				15,
				63,
				16,
				65,
				67,
				3,
				68,
				3,
				67,
				82,
				3,
				82,
				4,
				72,
				81,
				71,
				81,
				72,
				78,
				42,
				33,
				31,
				33,
				42,
				44,
				11,
				77,
				14,
				77,
				11,
				83,
				83,
				11,
				40,
				40,
				11,
				38,
				83,
				79,
				77,
				20,
				18,
				17,
				18,
				20,
				22,
				34,
				84,
				32,
				84,
				34,
				85,
				61,
				4,
				82,
				62,
				4,
				61,
				4,
				62,
				1,
				8,
				86,
				6,
				86,
				8,
				87,
				60,
				7,
				5,
				7,
				60,
				58,
				57,
				25,
				23,
				25,
				57,
				54,
				2,
				39,
				37,
				39,
				2,
				0,
				85,
				59,
				84,
				59,
				85,
				52,
				75,
				86,
				87,
				86,
				75,
				76,
				49,
				79,
				83,
				79,
				49,
				80,
				80,
				49,
				47,
				46,
				35,
				74,
				35,
				46,
				43,
				35,
				43,
				2,
				2,
				43,
				3,
				3,
				43,
				68,
				2,
				37,
				35,
				8,
				28,
				87,
				28,
				8,
				24,
				24,
				8,
				7,
				24,
				7,
				23,
				23,
				7,
				57,
				57,
				7,
				58,
				28,
				75,
				87,
				75,
				28,
				30,
				56,
				64,
				9,
				64,
				56,
				63,
				63,
				56,
				53,
				63,
				53,
				15,
				15,
				53,
				17,
				64,
				11,
				9,
				11,
				64,
				19,
				11,
				19,
				38,
				38,
				17,
				53,
				38,
				19,
				20,
				38,
				20,
				17,
				38,
				53,
				36,
				40,
				49,
				83,
				49,
				40,
				50,
				50,
				40,
				39,
				50,
				39,
				0,
				50,
				0,
				62,
				62,
				0,
				1,
				65,
				21,
				66,
				21,
				65,
				16,
				21,
				16,
				22,
				22,
				16,
				18,
				26,
				29,
				27,
				29,
				26,
				55,
				55,
				26,
				25,
				55,
				25,
				54,
				85,
				51,
				52,
				51,
				85,
				34,
				51,
				34,
				73,
				73,
				34,
				33,
				73,
				33,
				45,
				45,
				33,
				44,
				13,
				72,
				70,
				72,
				13,
				14,
				72,
				14,
				78,
				78,
				14,
				77,
				12,
				76,
				10,
				71,
				12,
				69,
				76,
				6,
				86,
				6,
				76,
				12,
				6,
				12,
				71,
				6,
				71,
				81,
				6,
				81,
				5,
				5,
				81,
				60,
				60,
				81,
				80,
				60,
				80,
				59,
				59,
				80,
				47,
				59,
				47,
				84,
				84,
				47,
				48,
				84,
				48,
				32,
				32,
				48,
				31,
				31,
				48,
				82,
				82,
				48,
				61,
				31,
				82,
				42,
				82,
				41,
				42,
				41,
				82,
				67
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2
			]
		},
		{
			set: "boulder",
			id: "rock_largeD",
			source: "kenney_nature-kit/Models/GLTF format/rock_largeD.glb",
			sha256: "e4fefd8d8d7deab42be61bd222bcd088330012f0025789146b81f25a46095ffd",
			size: [
				1.069,
				.568,
				1.03
			],
			positions: [
				.367,
				.568,
				-.116,
				.229,
				.568,
				-.297,
				.534,
				.312,
				-.156,
				.534,
				.235,
				-.234,
				.365,
				.235,
				-.455,
				.103,
				0,
				-.418,
				.291,
				0,
				-.369,
				.13,
				.235,
				-.515,
				.06,
				.235,
				.515,
				-.444,
				.235,
				.234,
				.036,
				.568,
				.314,
				-.281,
				.568,
				.137,
				.193,
				.402,
				.319,
				.092,
				.568,
				.277,
				.14,
				.568,
				.152,
				-.338,
				.568,
				-.076,
				-.534,
				.235,
				-.104,
				-.291,
				.568,
				-.172,
				-.351,
				.235,
				-.473,
				-.287,
				.402,
				-.391,
				.081,
				.568,
				-.335,
				-.071,
				.568,
				-.321,
				-.155,
				0,
				.294,
				-.356,
				0,
				.181,
				.055,
				.147,
				.475,
				.508,
				.081,
				-.15,
				.49,
				.235,
				-.095,
				-.428,
				0,
				-.089,
				.467,
				0,
				-.14,
				-.118,
				0,
				-.398,
				-.317,
				.118,
				-.428,
				.237,
				.235,
				.398,
				.212,
				.235,
				.117,
				.132,
				.568,
				.064,
				.11,
				0,
				.365,
				-.355,
				0,
				-.236,
				.169,
				0,
				.088,
				.189,
				0,
				.313
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				1,
				3,
				4,
				7,
				6,
				5,
				6,
				7,
				4,
				10,
				9,
				8,
				9,
				10,
				11,
				14,
				13,
				12,
				17,
				16,
				15,
				16,
				17,
				18,
				18,
				17,
				19,
				19,
				7,
				18,
				7,
				19,
				20,
				20,
				19,
				21,
				24,
				23,
				22,
				23,
				24,
				9,
				9,
				24,
				8,
				3,
				26,
				25,
				21,
				19,
				17,
				16,
				23,
				9,
				23,
				16,
				27,
				3,
				2,
				26,
				6,
				25,
				28,
				25,
				6,
				3,
				3,
				6,
				4,
				30,
				5,
				29,
				5,
				30,
				7,
				7,
				30,
				18,
				20,
				4,
				7,
				4,
				20,
				1,
				32,
				12,
				31,
				12,
				32,
				14,
				14,
				32,
				33,
				11,
				16,
				9,
				16,
				11,
				15,
				24,
				22,
				34,
				16,
				35,
				27,
				35,
				16,
				18,
				35,
				18,
				30,
				2,
				32,
				26,
				32,
				2,
				33,
				33,
				2,
				0,
				25,
				36,
				28,
				36,
				25,
				32,
				32,
				25,
				26,
				12,
				8,
				31,
				8,
				12,
				10,
				10,
				12,
				13,
				31,
				34,
				37,
				34,
				31,
				24,
				24,
				31,
				8,
				29,
				35,
				30,
				37,
				32,
				31,
				32,
				37,
				36,
				35,
				23,
				27,
				23,
				35,
				22,
				22,
				35,
				29,
				22,
				29,
				34,
				34,
				29,
				5,
				34,
				5,
				36,
				36,
				5,
				6,
				36,
				6,
				28,
				37,
				34,
				36,
				14,
				33,
				13,
				20,
				13,
				33,
				20,
				10,
				13,
				21,
				10,
				20,
				21,
				11,
				10,
				17,
				11,
				21,
				11,
				17,
				15,
				20,
				33,
				1,
				1,
				33,
				0,
				9,
				18,
				16,
				18,
				9,
				8,
				18,
				8,
				7,
				7,
				8,
				31,
				7,
				31,
				32,
				32,
				4,
				7,
				4,
				32,
				26,
				4,
				26,
				3
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			]
		},
		{
			set: "boulder",
			id: "rock_largeF",
			source: "kenney_nature-kit/Models/GLTF format/rock_largeF.glb",
			sha256: "4222107db4a47471494bdbf1eb2ad0ff297628afbcb7c392618e5742d831e0d4",
			size: [
				1.095,
				.479,
				.899
			],
			positions: [
				.438,
				0,
				-.043,
				.548,
				.211,
				-.057,
				.084,
				0,
				-.358,
				.105,
				.211,
				-.449,
				-.302,
				.139,
				.439,
				-.259,
				0,
				.378,
				-.405,
				.211,
				.38,
				-.548,
				.211,
				.22,
				-.371,
				0,
				.254,
				-.493,
				.106,
				.199,
				-.379,
				.211,
				-.044,
				-.371,
				0,
				.072,
				-.303,
				0,
				-.033,
				.145,
				0,
				.281,
				-.052,
				0,
				.313,
				.384,
				.106,
				.28,
				-.065,
				.211,
				.389,
				.427,
				.211,
				.31,
				-.258,
				.211,
				.449,
				-.04,
				.479,
				.243,
				-.302,
				.259,
				.439,
				-.2,
				.479,
				.294,
				.39,
				0,
				.103,
				.345,
				.345,
				.252,
				.3,
				.479,
				.082,
				.338,
				.479,
				-.031,
				.112,
				.479,
				.219,
				-.443,
				.345,
				.18,
				-.286,
				.479,
				.058,
				-.273,
				.479,
				.212,
				-.222,
				0,
				-.253,
				-.277,
				.211,
				-.318,
				-.234,
				.479,
				-.023,
				-.171,
				.479,
				-.192,
				.065,
				.479,
				-.273
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				6,
				5,
				4,
				5,
				6,
				7,
				5,
				7,
				8,
				8,
				7,
				9,
				10,
				9,
				7,
				9,
				10,
				11,
				11,
				10,
				12,
				15,
				14,
				13,
				14,
				15,
				16,
				16,
				15,
				17,
				19,
				18,
				16,
				18,
				19,
				20,
				20,
				19,
				21,
				22,
				15,
				13,
				1,
				23,
				17,
				23,
				1,
				24,
				24,
				1,
				25,
				23,
				24,
				26,
				16,
				5,
				14,
				5,
				16,
				4,
				4,
				16,
				18,
				29,
				28,
				27,
				10,
				30,
				12,
				30,
				10,
				31,
				33,
				10,
				32,
				10,
				33,
				31,
				34,
				1,
				3,
				1,
				34,
				25,
				33,
				3,
				31,
				3,
				33,
				34,
				20,
				6,
				18,
				6,
				27,
				7,
				27,
				6,
				29,
				29,
				6,
				20,
				29,
				20,
				21,
				23,
				16,
				17,
				16,
				23,
				19,
				19,
				23,
				26,
				6,
				4,
				18,
				8,
				9,
				11,
				15,
				1,
				17,
				1,
				15,
				22,
				1,
				22,
				0,
				27,
				10,
				7,
				10,
				27,
				28,
				10,
				28,
				32,
				31,
				2,
				30,
				2,
				31,
				3,
				12,
				8,
				11,
				8,
				12,
				5,
				5,
				12,
				30,
				5,
				30,
				14,
				14,
				30,
				2,
				14,
				2,
				13,
				13,
				2,
				0,
				13,
				0,
				22,
				29,
				32,
				28,
				32,
				29,
				21,
				32,
				21,
				33,
				33,
				21,
				19,
				33,
				19,
				34,
				34,
				19,
				26,
				34,
				26,
				25,
				25,
				26,
				24,
				6,
				10,
				7,
				10,
				6,
				18,
				10,
				18,
				31,
				31,
				18,
				3,
				3,
				18,
				16,
				3,
				16,
				17,
				3,
				17,
				1
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			]
		},
		{
			set: "boulder",
			id: "rock_largeB",
			source: "kenney_nature-kit/Models/GLTF format/rock_largeB.glb",
			sha256: "caa8b025833d4dabf6d98fe2e96cf2fbd886693ac990df0db75f9d827194374b",
			size: [
				.767,
				.43,
				1.015
			],
			positions: [
				.309,
				.17,
				.257,
				.216,
				.43,
				.233,
				.309,
				.17,
				.031,
				.216,
				.43,
				.021,
				-.297,
				0,
				-.225,
				-.159,
				0,
				-.396,
				-.383,
				.17,
				-.289,
				-.207,
				.17,
				-.508,
				-.262,
				.43,
				-.199,
				-.14,
				.43,
				-.35,
				.358,
				.085,
				-.157,
				.38,
				.128,
				-.167,
				.244,
				0,
				-.244,
				.356,
				.17,
				-.245,
				.172,
				0,
				-.35,
				.219,
				.17,
				-.449,
				.162,
				.43,
				.35,
				.376,
				.17,
				.462,
				.243,
				0,
				.263,
				.295,
				0,
				.36,
				-.171,
				.43,
				.012,
				-.273,
				.3,
				-.058,
				-.242,
				.43,
				-.123,
				.28,
				.43,
				-.122,
				.217,
				.43,
				-.216,
				.383,
				.209,
				-.168,
				.186,
				.3,
				-.38,
				-.288,
				.085,
				-.061,
				-.154,
				0,
				.061,
				-.274,
				0,
				-.139,
				.243,
				0,
				.024,
				.086,
				.17,
				.415,
				.069,
				0,
				.324,
				-.325,
				.17,
				-.069,
				.007,
				.43,
				-.33,
				.279,
				0,
				-.057,
				.356,
				.17,
				-.073,
				.182,
				0,
				.396,
				.231,
				.17,
				.508,
				.062,
				.43,
				.286
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				6,
				5,
				4,
				5,
				6,
				7,
				9,
				6,
				8,
				6,
				9,
				7,
				12,
				11,
				10,
				11,
				12,
				13,
				13,
				12,
				14,
				13,
				14,
				15,
				17,
				1,
				16,
				0,
				19,
				18,
				22,
				21,
				20,
				25,
				24,
				23,
				24,
				25,
				13,
				24,
				13,
				26,
				26,
				13,
				15,
				29,
				28,
				27,
				30,
				0,
				18,
				0,
				30,
				2,
				0,
				17,
				19,
				33,
				32,
				31,
				32,
				33,
				28,
				28,
				33,
				27,
				9,
				15,
				7,
				15,
				9,
				26,
				26,
				9,
				34,
				10,
				35,
				12,
				13,
				36,
				11,
				13,
				25,
				36,
				30,
				36,
				2,
				36,
				30,
				35,
				36,
				35,
				10,
				36,
				10,
				11,
				33,
				29,
				27,
				29,
				33,
				6,
				29,
				6,
				4,
				22,
				33,
				21,
				33,
				22,
				6,
				6,
				22,
				8,
				38,
				32,
				37,
				32,
				38,
				31,
				16,
				31,
				38,
				31,
				16,
				39,
				5,
				29,
				4,
				29,
				5,
				28,
				28,
				5,
				14,
				28,
				14,
				32,
				32,
				14,
				37,
				37,
				14,
				12,
				37,
				12,
				30,
				30,
				12,
				35,
				18,
				37,
				30,
				37,
				18,
				19,
				17,
				37,
				19,
				37,
				17,
				38,
				16,
				38,
				17,
				1,
				17,
				0,
				39,
				33,
				31,
				33,
				39,
				20,
				33,
				20,
				21,
				36,
				3,
				2,
				3,
				36,
				23,
				23,
				36,
				25,
				7,
				14,
				5,
				14,
				7,
				15,
				24,
				26,
				34,
				7,
				33,
				6,
				33,
				7,
				31,
				31,
				7,
				15,
				31,
				15,
				38,
				38,
				15,
				2,
				2,
				15,
				13,
				2,
				13,
				36,
				38,
				0,
				17,
				0,
				38,
				2,
				22,
				9,
				8,
				9,
				22,
				20,
				9,
				20,
				39,
				9,
				39,
				34,
				34,
				39,
				24,
				24,
				39,
				16,
				24,
				16,
				3,
				3,
				16,
				1,
				24,
				3,
				23
			],
			roles: [
				0,
				0,
				2,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				0,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			]
		},
		{
			set: "spire",
			id: "rock_tallC",
			source: "kenney_nature-kit/Models/GLTF format/rock_tallC.glb",
			sha256: "87943b8b0d244ec9832d5dca9bf3cee2ab62aaa81797749f21a972f85c1f3be4",
			size: [
				.456,
				.783,
				.437
			],
			positions: [
				.114,
				0,
				-.218,
				.228,
				0,
				-.152,
				.068,
				.646,
				-.131,
				.137,
				.646,
				-.091,
				.056,
				.646,
				.05,
				-.025,
				.646,
				.131,
				.025,
				.783,
				.037,
				-.03,
				.783,
				.092,
				-.228,
				0,
				-.152,
				-.137,
				.646,
				-.091,
				-.034,
				.646,
				-.111,
				-.042,
				0,
				.218,
				-.228,
				0,
				.111,
				-.137,
				.646,
				.067,
				.137,
				.646,
				-.03,
				.228,
				0,
				-.05,
				-.036,
				.783,
				-.072,
				-.106,
				.783,
				.048,
				-.106,
				.783,
				-.059
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				6,
				5,
				4,
				5,
				6,
				7,
				9,
				0,
				8,
				0,
				9,
				2,
				2,
				9,
				10,
				5,
				12,
				11,
				12,
				5,
				13,
				15,
				3,
				14,
				3,
				15,
				1,
				10,
				6,
				4,
				6,
				10,
				16,
				17,
				9,
				13,
				9,
				17,
				18,
				14,
				11,
				15,
				11,
				14,
				5,
				5,
				14,
				4,
				18,
				10,
				9,
				10,
				18,
				16,
				7,
				13,
				5,
				13,
				7,
				17,
				13,
				8,
				12,
				8,
				13,
				9,
				0,
				12,
				8,
				12,
				0,
				11,
				11,
				0,
				15,
				15,
				0,
				1,
				5,
				9,
				13,
				9,
				5,
				10,
				10,
				5,
				4,
				7,
				18,
				17,
				18,
				7,
				16,
				16,
				7,
				6,
				4,
				2,
				10,
				2,
				4,
				14,
				2,
				14,
				3
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			]
		},
		{
			set: "spire",
			id: "rock_tallG",
			source: "kenney_nature-kit/Models/GLTF format/rock_tallG.glb",
			sha256: "831683e6f920d0d6156132f73a1078ed4d0470bc3e862eff4436763898c68a96",
			size: [
				.425,
				.783,
				.491
			],
			positions: [
				.157,
				.534,
				.101,
				.138,
				.783,
				.097,
				.157,
				.534,
				.011,
				.138,
				.783,
				.022,
				0,
				.534,
				.192,
				.001,
				.577,
				.189,
				.052,
				.783,
				.146,
				0,
				.382,
				.211,
				-.183,
				.382,
				.105,
				-.157,
				.534,
				.101,
				-.071,
				.534,
				.151,
				.212,
				0,
				.123,
				0,
				0,
				.245,
				.183,
				.382,
				.105,
				-.183,
				.382,
				0,
				-.157,
				.534,
				.057,
				-.177,
				.414,
				.002,
				-.015,
				.534,
				-.041,
				-.051,
				.783,
				.138,
				-.005,
				.783,
				-.022,
				-.114,
				.534,
				-.005,
				0,
				0,
				-.245,
				.212,
				0,
				-.123,
				0,
				.191,
				-.228,
				.183,
				.382,
				-.105,
				.08,
				.382,
				-.165,
				-.018,
				.382,
				-.06,
				-.048,
				.382,
				-.183,
				.183,
				.382,
				0,
				-.025,
				.783,
				.153,
				-.212,
				0,
				-.123,
				-.183,
				.382,
				-.105,
				-.212,
				0,
				.123
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				1,
				4,
				0,
				4,
				1,
				5,
				5,
				1,
				6,
				4,
				8,
				7,
				8,
				4,
				9,
				9,
				4,
				10,
				13,
				12,
				11,
				12,
				13,
				7,
				9,
				14,
				8,
				14,
				9,
				15,
				14,
				15,
				16,
				0,
				7,
				13,
				7,
				0,
				4,
				18,
				17,
				10,
				17,
				18,
				19,
				20,
				16,
				15,
				23,
				22,
				21,
				22,
				23,
				24,
				24,
				23,
				25,
				16,
				26,
				14,
				26,
				16,
				17,
				17,
				16,
				20,
				25,
				23,
				27,
				28,
				0,
				13,
				0,
				28,
				2,
				5,
				10,
				4,
				10,
				5,
				18,
				18,
				5,
				29,
				17,
				28,
				26,
				28,
				17,
				2,
				31,
				21,
				30,
				21,
				31,
				23,
				23,
				31,
				27,
				19,
				2,
				17,
				2,
				19,
				3,
				29,
				5,
				6,
				7,
				32,
				12,
				32,
				7,
				8,
				8,
				30,
				32,
				30,
				8,
				14,
				30,
				14,
				31,
				22,
				13,
				11,
				13,
				22,
				28,
				28,
				22,
				24,
				21,
				32,
				30,
				32,
				21,
				12,
				12,
				21,
				22,
				12,
				22,
				11,
				14,
				27,
				31,
				27,
				14,
				26,
				27,
				26,
				25,
				25,
				26,
				28,
				25,
				28,
				24,
				29,
				19,
				18,
				19,
				29,
				6,
				19,
				6,
				3,
				3,
				6,
				1,
				9,
				20,
				15,
				20,
				9,
				10,
				20,
				10,
				17
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			]
		},
		{
			set: "spire",
			id: "rock_tallH",
			source: "kenney_nature-kit/Models/GLTF format/rock_tallH.glb",
			sha256: "bc1db23172176726c4f9fac55c1114a7619fb414e4ca62f242bc48a89d7a9300",
			size: [
				.575,
				.711,
				.664
			],
			positions: [
				.018,
				.202,
				.057,
				.23,
				.202,
				.057,
				.015,
				.332,
				.053,
				.193,
				.332,
				.053,
				0,
				0,
				.332,
				-.287,
				0,
				.166,
				0,
				.202,
				.266,
				-.23,
				.202,
				.133,
				.154,
				.587,
				.109,
				.067,
				.711,
				.144,
				.135,
				.711,
				.073,
				.01,
				.711,
				.06,
				.135,
				.711,
				.06,
				-.193,
				.332,
				.117,
				-.193,
				.332,
				.009,
				-.135,
				.711,
				.105,
				-.135,
				.711,
				.029,
				-.23,
				.202,
				-.133,
				-.115,
				.202,
				-.199,
				-.224,
				.223,
				-.129,
				-.097,
				.332,
				-.162,
				-.162,
				.332,
				-.124,
				.287,
				0,
				.166,
				.23,
				.202,
				.133,
				.287,
				0,
				-.166,
				.23,
				.202,
				-.133,
				0,
				0,
				-.332,
				0,
				.202,
				-.266,
				0,
				.332,
				.228,
				-.088,
				.332,
				-.073,
				-.061,
				.711,
				-.028,
				0,
				.711,
				.183,
				.193,
				.332,
				.117,
				-.287,
				0,
				-.166,
				.02,
				.711,
				.009,
				.028,
				.332,
				-.02,
				.05,
				.202,
				-.117,
				.046,
				.267,
				-.105,
				-.006,
				.332,
				-.117,
				.032,
				.332,
				-.041,
				-.193,
				.332,
				-.041
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				6,
				5,
				4,
				5,
				6,
				7,
				10,
				9,
				8,
				11,
				3,
				2,
				3,
				11,
				12,
				15,
				14,
				13,
				14,
				15,
				16,
				19,
				18,
				17,
				18,
				19,
				20,
				20,
				19,
				21,
				24,
				23,
				22,
				23,
				24,
				1,
				1,
				24,
				25,
				27,
				24,
				26,
				24,
				27,
				25,
				28,
				7,
				6,
				7,
				28,
				13,
				16,
				29,
				14,
				29,
				16,
				30,
				31,
				13,
				28,
				13,
				31,
				15,
				8,
				28,
				32,
				28,
				8,
				31,
				31,
				8,
				9,
				32,
				6,
				23,
				6,
				32,
				28,
				7,
				33,
				5,
				33,
				7,
				17,
				3,
				8,
				32,
				8,
				3,
				10,
				10,
				3,
				12,
				2,
				34,
				11,
				34,
				2,
				35,
				23,
				4,
				22,
				4,
				23,
				6,
				20,
				36,
				18,
				36,
				20,
				37,
				37,
				20,
				38,
				36,
				2,
				0,
				2,
				36,
				35,
				35,
				36,
				39,
				39,
				36,
				37,
				1,
				32,
				23,
				32,
				1,
				3,
				38,
				39,
				37,
				19,
				40,
				21,
				17,
				26,
				33,
				26,
				17,
				27,
				27,
				17,
				18,
				13,
				17,
				7,
				17,
				13,
				14,
				17,
				14,
				40,
				17,
				40,
				19,
				30,
				35,
				29,
				35,
				30,
				34,
				1,
				36,
				0,
				25,
				36,
				1,
				27,
				36,
				25,
				36,
				27,
				18,
				9,
				11,
				31,
				11,
				9,
				12,
				12,
				9,
				10,
				30,
				31,
				11,
				16,
				31,
				30,
				31,
				16,
				15,
				30,
				11,
				34,
				29,
				40,
				14,
				40,
				29,
				21,
				21,
				29,
				20,
				20,
				29,
				38,
				38,
				29,
				35,
				38,
				35,
				39,
				26,
				5,
				33,
				5,
				26,
				4,
				4,
				26,
				24,
				4,
				24,
				22
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				2,
				2,
				2,
				2
			]
		},
		{
			set: "spire",
			id: "rock_tallI",
			source: "kenney_nature-kit/Models/GLTF format/rock_tallI.glb",
			sha256: "653ac732b440346ad7addd65e92caa54e34e150d78f0ea6fec8863a07cdb9e4c",
			size: [
				.456,
				.812,
				.464
			],
			positions: [
				.093,
				.621,
				.116,
				-.041,
				.621,
				.146,
				.065,
				.812,
				.095,
				-.037,
				.812,
				.119,
				.148,
				0,
				.184,
				-.065,
				0,
				.232,
				-.144,
				.621,
				.087,
				-.144,
				.621,
				.004,
				-.115,
				.812,
				.073,
				-.115,
				.812,
				.01,
				.179,
				.362,
				.108,
				.116,
				.621,
				.103,
				.144,
				.621,
				-.006,
				-.043,
				.621,
				-.084,
				-.016,
				.812,
				-.023,
				-.041,
				.716,
				-.071,
				.228,
				0,
				.138,
				-.077,
				.812,
				-.023,
				.043,
				0,
				-.232,
				.228,
				0,
				-.126,
				.027,
				.621,
				-.146,
				.144,
				.621,
				-.079,
				-.228,
				0,
				.138,
				-.228,
				0,
				.006
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				0,
				5,
				4,
				5,
				0,
				1,
				8,
				7,
				6,
				7,
				8,
				9,
				3,
				6,
				1,
				6,
				3,
				8,
				12,
				11,
				10,
				13,
				2,
				0,
				2,
				13,
				14,
				14,
				13,
				15,
				10,
				4,
				16,
				4,
				10,
				0,
				0,
				10,
				11,
				14,
				15,
				17,
				20,
				19,
				18,
				19,
				20,
				21,
				19,
				10,
				16,
				10,
				19,
				12,
				12,
				19,
				21,
				6,
				23,
				22,
				23,
				6,
				7,
				9,
				13,
				7,
				13,
				9,
				15,
				15,
				9,
				17,
				1,
				22,
				5,
				22,
				1,
				6,
				7,
				18,
				23,
				18,
				7,
				20,
				20,
				7,
				13,
				0,
				20,
				13,
				20,
				0,
				21,
				21,
				0,
				11,
				21,
				11,
				12,
				3,
				9,
				8,
				9,
				3,
				17,
				17,
				3,
				14,
				14,
				3,
				2,
				18,
				22,
				23,
				22,
				18,
				5,
				5,
				18,
				4,
				4,
				18,
				19,
				4,
				19,
				16
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				2,
				2,
				2,
				2,
				2
			]
		},
		{
			set: "spire",
			id: "rock_tallF",
			source: "kenney_nature-kit/Models/GLTF format/rock_tallF.glb",
			sha256: "823cecdfa45e9b23c608a4b3ade9e699e0dea0e0141dde4e757fe97ad5850c10",
			size: [
				.444,
				.574,
				.512
			],
			positions: [
				0,
				0,
				-.256,
				.222,
				0,
				-.128,
				0,
				.267,
				-.192,
				.166,
				.267,
				-.096,
				-.222,
				0,
				-.128,
				-.2,
				.103,
				-.116,
				-.114,
				.267,
				-.126,
				.222,
				0,
				.128,
				0,
				0,
				.256,
				.166,
				.267,
				.096,
				0,
				.267,
				.192,
				-.166,
				.267,
				.096,
				-.166,
				.267,
				0,
				-.128,
				.574,
				.088,
				-.128,
				.574,
				.014,
				.128,
				.574,
				.058,
				.086,
				.574,
				.001,
				.164,
				.284,
				.001,
				-.166,
				.267,
				-.036,
				-.036,
				.267,
				-.066,
				.166,
				.267,
				0,
				-.028,
				.574,
				-.037,
				0,
				.574,
				.162,
				.128,
				.574,
				.088,
				-.222,
				0,
				.128
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				5,
				0,
				4,
				0,
				5,
				2,
				2,
				5,
				6,
				9,
				8,
				7,
				8,
				9,
				10,
				13,
				12,
				11,
				12,
				13,
				14,
				17,
				16,
				15,
				6,
				5,
				18,
				21,
				20,
				19,
				20,
				21,
				17,
				17,
				21,
				16,
				22,
				11,
				10,
				11,
				22,
				13,
				20,
				23,
				9,
				23,
				20,
				15,
				15,
				20,
				17,
				14,
				19,
				12,
				19,
				14,
				21,
				23,
				10,
				9,
				10,
				23,
				22,
				10,
				24,
				8,
				24,
				10,
				11,
				1,
				9,
				7,
				9,
				1,
				20,
				20,
				1,
				3,
				11,
				4,
				24,
				4,
				11,
				12,
				4,
				12,
				18,
				4,
				18,
				5,
				13,
				21,
				14,
				21,
				13,
				22,
				21,
				22,
				16,
				16,
				22,
				23,
				16,
				23,
				15,
				12,
				6,
				18,
				6,
				12,
				19,
				6,
				19,
				2,
				2,
				19,
				20,
				2,
				20,
				3,
				0,
				24,
				4,
				24,
				0,
				8,
				8,
				0,
				1,
				8,
				1,
				7
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				2,
				2,
				2,
				2
			]
		},
		{
			set: "small",
			id: "rock_smallE",
			source: "kenney_nature-kit/Models/GLTF format/rock_smallE.glb",
			sha256: "e6e03586ca03316bab707ced869f5d4fa50dccc67dd056e94b667fc1e929c05c",
			size: [
				.361,
				.256,
				.312
			],
			positions: [
				.029,
				.177,
				.051,
				.018,
				.256,
				.032,
				.07,
				.177,
				-.019,
				.048,
				.256,
				-.019,
				-.052,
				.177,
				.051,
				-.043,
				.24,
				.036,
				.003,
				.256,
				.032,
				-.056,
				.256,
				-.045,
				-.049,
				.197,
				-.085,
				-.011,
				.256,
				-.07,
				.074,
				.145,
				.128,
				-.013,
				.177,
				.122,
				.091,
				.177,
				.087,
				.029,
				.177,
				-.089,
				.018,
				.256,
				-.07,
				-.18,
				0,
				0,
				-.09,
				0,
				.156,
				-.09,
				0,
				-.156,
				.09,
				0,
				-.156,
				.09,
				0,
				.156,
				.18,
				0,
				0,
				-.092,
				.177,
				-.019,
				-.062,
				.256,
				-.005,
				-.07,
				.256,
				-.019,
				-.052,
				.177,
				-.089,
				-.07,
				.177,
				-.122,
				.084,
				.055,
				-.146,
				.039,
				.177,
				-.122,
				.141,
				.177,
				0,
				.091,
				.177,
				-.087,
				-.126,
				.177,
				.025,
				-.154,
				.118,
				0,
				-.122,
				.177,
				-.033,
				-.07,
				.177,
				.122
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				1,
				4,
				0,
				4,
				1,
				5,
				5,
				1,
				6,
				9,
				8,
				7,
				12,
				11,
				10,
				13,
				3,
				2,
				3,
				13,
				14,
				17,
				16,
				15,
				16,
				17,
				18,
				16,
				18,
				19,
				19,
				18,
				20,
				5,
				21,
				4,
				21,
				5,
				22,
				21,
				22,
				23,
				8,
				13,
				24,
				13,
				8,
				14,
				14,
				8,
				9,
				25,
				18,
				17,
				18,
				25,
				26,
				26,
				25,
				27,
				18,
				28,
				20,
				28,
				18,
				29,
				29,
				18,
				26,
				29,
				26,
				27,
				32,
				31,
				30,
				33,
				15,
				16,
				15,
				33,
				30,
				15,
				30,
				31,
				32,
				15,
				31,
				15,
				32,
				17,
				17,
				32,
				25,
				6,
				22,
				5,
				7,
				21,
				23,
				21,
				7,
				24,
				24,
				7,
				8,
				20,
				10,
				19,
				10,
				20,
				12,
				12,
				20,
				28,
				10,
				16,
				19,
				16,
				10,
				33,
				33,
				10,
				11,
				22,
				7,
				23,
				7,
				22,
				6,
				7,
				6,
				9,
				9,
				6,
				14,
				14,
				6,
				1,
				14,
				1,
				3,
				33,
				32,
				30,
				32,
				33,
				21,
				21,
				33,
				4,
				4,
				33,
				11,
				4,
				11,
				0,
				0,
				11,
				12,
				0,
				12,
				2,
				21,
				25,
				32,
				25,
				21,
				24,
				25,
				24,
				27,
				27,
				24,
				13,
				27,
				13,
				2,
				27,
				2,
				29,
				29,
				2,
				12,
				29,
				12,
				28
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			]
		},
		{
			set: "small",
			id: "rock_smallH",
			source: "kenney_nature-kit/Models/GLTF format/rock_smallH.glb",
			sha256: "c798f7445350e8d79710a1d3e344b9ce4d4bcff5416a50268781d5121a353a7f",
			size: [
				.462,
				.407,
				.462
			],
			positions: [
				0,
				.274,
				-.231,
				.163,
				.274,
				-.163,
				0,
				.407,
				-.141,
				.1,
				.407,
				-.1,
				-.163,
				.13,
				.163,
				-.108,
				0,
				.108,
				-.231,
				.13,
				0,
				-.152,
				0,
				0,
				.163,
				.13,
				.163,
				.231,
				.13,
				0,
				.108,
				0,
				.108,
				.152,
				0,
				0,
				-.231,
				.274,
				0,
				-.163,
				.274,
				-.163,
				-.163,
				.13,
				-.163,
				0,
				.13,
				.231,
				.163,
				.274,
				.163,
				0,
				.274,
				.231,
				-.163,
				.274,
				.163,
				0,
				.407,
				.141,
				-.1,
				.407,
				.1,
				-.108,
				0,
				-.108,
				0,
				0,
				-.152,
				0,
				0,
				.152,
				.108,
				0,
				-.108,
				0,
				.13,
				-.231,
				.141,
				.407,
				0,
				.231,
				.274,
				0,
				.163,
				.13,
				-.163,
				-.1,
				.407,
				-.1,
				-.141,
				.407,
				0,
				.1,
				.407,
				.1
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				6,
				5,
				4,
				5,
				6,
				7,
				10,
				9,
				8,
				9,
				10,
				11,
				13,
				6,
				12,
				6,
				13,
				14,
				16,
				15,
				8,
				15,
				16,
				17,
				19,
				18,
				17,
				18,
				19,
				20,
				21,
				5,
				7,
				5,
				21,
				22,
				5,
				22,
				23,
				23,
				22,
				24,
				23,
				24,
				10,
				10,
				24,
				11,
				13,
				25,
				14,
				25,
				13,
				0,
				27,
				3,
				26,
				3,
				27,
				1,
				25,
				24,
				22,
				24,
				25,
				28,
				14,
				22,
				21,
				22,
				14,
				25,
				9,
				16,
				8,
				16,
				9,
				27,
				24,
				9,
				11,
				9,
				24,
				28,
				29,
				0,
				13,
				0,
				29,
				2,
				14,
				7,
				6,
				7,
				14,
				21,
				0,
				28,
				25,
				28,
				0,
				1,
				15,
				5,
				23,
				5,
				15,
				4,
				28,
				27,
				9,
				27,
				28,
				1,
				29,
				12,
				30,
				12,
				29,
				13,
				17,
				4,
				15,
				4,
				17,
				18,
				27,
				31,
				16,
				31,
				27,
				26,
				12,
				4,
				18,
				4,
				12,
				6,
				20,
				12,
				18,
				12,
				20,
				30,
				8,
				23,
				10,
				23,
				8,
				15,
				31,
				17,
				16,
				17,
				31,
				19,
				20,
				29,
				30,
				29,
				20,
				19,
				29,
				19,
				2,
				2,
				19,
				31,
				2,
				31,
				3,
				3,
				31,
				26
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				2,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			]
		},
		{
			set: "small",
			id: "rock_smallTopB",
			source: "kenney_nature-kit/Models/GLTF format/rock_smallTopB.glb",
			sha256: "134e2a324190f6093b80c05fb3e1b6c46681d6462953de99bb54bf4c8a7665c6",
			size: [
				.622,
				.28,
				.646
			],
			positions: [
				.087,
				.16,
				.024,
				-.048,
				.16,
				.063,
				.079,
				.195,
				.018,
				-.04,
				.28,
				.032,
				.027,
				.28,
				.013,
				-.06,
				.19,
				.14,
				-.072,
				.16,
				.139,
				-.03,
				.19,
				.108,
				-.031,
				.16,
				.096,
				.296,
				0,
				.214,
				.232,
				.133,
				.168,
				.311,
				0,
				-.185,
				.221,
				.16,
				.1,
				.227,
				.16,
				-.058,
				.291,
				.039,
				-.174,
				.022,
				.16,
				.121,
				.01,
				.19,
				.127,
				.014,
				.16,
				.179,
				-.043,
				.16,
				.19,
				.004,
				.19,
				.17,
				-.039,
				.19,
				.178,
				-.252,
				.118,
				-.007,
				-.311,
				0,
				-.009,
				-.192,
				.16,
				-.055,
				-.064,
				0,
				-.323,
				-.047,
				.16,
				-.239,
				.06,
				.28,
				-.03,
				-.04,
				.16,
				-.165,
				.093,
				.16,
				-.117,
				-.034,
				.28,
				-.135,
				.063,
				.28,
				-.099,
				-.111,
				.16,
				.172,
				-.112,
				.22,
				-.054,
				-.127,
				.16,
				-.055,
				-.065,
				.28,
				-.094,
				-.078,
				.28,
				-.025,
				.156,
				.16,
				-.165,
				-.088,
				0,
				.323,
				-.065,
				.16,
				.239,
				.027,
				.16,
				.213
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				3,
				2,
				4,
				7,
				6,
				5,
				6,
				7,
				8,
				11,
				10,
				9,
				10,
				11,
				12,
				12,
				11,
				13,
				13,
				11,
				14,
				7,
				15,
				8,
				15,
				7,
				16,
				19,
				18,
				17,
				18,
				19,
				20,
				23,
				22,
				21,
				22,
				23,
				24,
				24,
				23,
				25,
				26,
				4,
				2,
				29,
				28,
				27,
				28,
				29,
				30,
				28,
				2,
				0,
				2,
				28,
				26,
				26,
				28,
				30,
				31,
				23,
				21,
				15,
				19,
				17,
				19,
				15,
				16,
				34,
				33,
				32,
				33,
				34,
				27,
				27,
				34,
				29,
				34,
				32,
				35,
				14,
				36,
				13,
				10,
				37,
				9,
				37,
				10,
				38,
				38,
				10,
				39,
				3,
				33,
				1,
				33,
				3,
				35,
				33,
				35,
				32,
				24,
				37,
				22,
				37,
				24,
				9,
				9,
				24,
				11,
				25,
				11,
				24,
				11,
				25,
				14,
				14,
				25,
				36,
				10,
				12,
				39,
				38,
				22,
				37,
				22,
				38,
				31,
				22,
				31,
				21,
				20,
				6,
				18,
				6,
				20,
				5,
				20,
				7,
				5,
				7,
				20,
				19,
				7,
				19,
				16,
				38,
				6,
				31,
				6,
				38,
				18,
				18,
				38,
				39,
				18,
				39,
				17,
				17,
				39,
				15,
				1,
				31,
				6,
				33,
				31,
				1,
				31,
				33,
				23,
				1,
				6,
				8,
				1,
				8,
				0,
				0,
				8,
				15,
				0,
				15,
				39,
				0,
				39,
				12,
				0,
				12,
				28,
				28,
				12,
				36,
				36,
				12,
				13,
				33,
				25,
				23,
				25,
				33,
				27,
				25,
				27,
				36,
				36,
				27,
				28,
				3,
				34,
				35,
				34,
				3,
				29,
				29,
				3,
				4,
				29,
				4,
				30,
				30,
				4,
				26
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			]
		},
		{
			set: "small",
			id: "rock_smallI",
			source: "kenney_nature-kit/Models/GLTF format/rock_smallI.glb",
			sha256: "f7bbf2f4efbfe63977c4c6520762143ede95c63bff6484b9719db5e666a618e4",
			size: [
				.358,
				.278,
				.414
			],
			positions: [
				-.092,
				.278,
				.053,
				-.092,
				.278,
				-.053,
				0,
				.278,
				.107,
				0,
				.278,
				-.107,
				.092,
				.278,
				.053,
				.092,
				.278,
				-.053,
				0,
				0,
				-.17,
				.147,
				0,
				-.085,
				0,
				.065,
				-.207,
				.179,
				.065,
				-.103,
				.179,
				.065,
				.103,
				0,
				.065,
				.207,
				.157,
				.206,
				.09,
				0,
				.206,
				.181,
				0,
				0,
				.17,
				-.147,
				0,
				.085,
				-.179,
				.065,
				.103,
				-.179,
				.065,
				-.103,
				-.147,
				0,
				-.085,
				-.157,
				.206,
				-.09,
				0,
				.206,
				-.181,
				-.157,
				.206,
				.09,
				.147,
				0,
				.085,
				.157,
				.206,
				-.09
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				3,
				2,
				4,
				3,
				4,
				5,
				8,
				7,
				6,
				7,
				8,
				9,
				12,
				11,
				10,
				11,
				12,
				13,
				11,
				15,
				14,
				15,
				11,
				16,
				12,
				2,
				13,
				2,
				12,
				4,
				17,
				15,
				16,
				15,
				17,
				18,
				1,
				20,
				19,
				20,
				1,
				3,
				13,
				16,
				11,
				16,
				13,
				21,
				6,
				15,
				18,
				15,
				6,
				14,
				14,
				6,
				7,
				14,
				7,
				22,
				21,
				17,
				16,
				17,
				21,
				19,
				10,
				14,
				22,
				14,
				10,
				11,
				5,
				20,
				3,
				20,
				5,
				23,
				17,
				6,
				18,
				6,
				17,
				8,
				22,
				9,
				10,
				9,
				22,
				7,
				13,
				0,
				21,
				0,
				13,
				2,
				19,
				8,
				17,
				8,
				19,
				20,
				0,
				19,
				21,
				19,
				0,
				1,
				23,
				4,
				12,
				4,
				23,
				5,
				20,
				9,
				8,
				9,
				20,
				23,
				9,
				12,
				10,
				12,
				9,
				23
			],
			roles: [
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			]
		},
		{
			set: "small",
			id: "rock_smallF",
			source: "kenney_nature-kit/Models/GLTF format/rock_smallF.glb",
			sha256: "51099549e8dd6a68db2afe2e5c514a8601ee59e11766d5975c540314f9b7deb8",
			size: [
				.354,
				.245,
				.306
			],
			positions: [
				.088,
				0,
				.153,
				-.088,
				0,
				.153,
				.071,
				.115,
				.122,
				-.077,
				.076,
				.133,
				-.026,
				.115,
				.122,
				-.085,
				.115,
				.098,
				.05,
				.115,
				.087,
				-.05,
				.115,
				.087,
				.044,
				.158,
				.077,
				-.031,
				.245,
				.055,
				-.007,
				.245,
				.055,
				-.141,
				.115,
				0,
				-.177,
				0,
				0,
				-.093,
				.115,
				-.084,
				-.088,
				0,
				-.153,
				-.085,
				.023,
				-.147,
				.063,
				.245,
				0,
				.031,
				.245,
				-.055,
				.101,
				.115,
				0,
				.05,
				.115,
				-.087,
				-.101,
				.115,
				0,
				-.063,
				.245,
				0,
				-.031,
				.245,
				-.055,
				-.05,
				.115,
				-.087,
				.043,
				.245,
				.035,
				.088,
				0,
				-.153,
				.177,
				0,
				0,
				-.026,
				.115,
				-.122,
				.071,
				.115,
				-.122,
				.124,
				.115,
				.029,
				.161,
				.051,
				0,
				.117,
				.115,
				-.042
			],
			indices: [
				2,
				1,
				0,
				1,
				2,
				3,
				3,
				2,
				4,
				5,
				3,
				4,
				8,
				7,
				6,
				7,
				8,
				9,
				9,
				8,
				10,
				13,
				12,
				11,
				12,
				13,
				14,
				14,
				13,
				15,
				18,
				17,
				16,
				17,
				18,
				19,
				9,
				20,
				7,
				20,
				9,
				21,
				22,
				20,
				21,
				20,
				22,
				23,
				18,
				8,
				6,
				8,
				18,
				24,
				24,
				18,
				16,
				14,
				1,
				12,
				1,
				14,
				25,
				1,
				25,
				0,
				0,
				25,
				26,
				22,
				19,
				23,
				19,
				22,
				17,
				27,
				15,
				13,
				3,
				12,
				1,
				12,
				3,
				5,
				12,
				5,
				11,
				15,
				25,
				14,
				25,
				15,
				28,
				28,
				15,
				27,
				26,
				2,
				0,
				2,
				26,
				29,
				29,
				26,
				30,
				10,
				8,
				24,
				31,
				29,
				30,
				25,
				30,
				26,
				30,
				25,
				31,
				31,
				25,
				28,
				9,
				22,
				21,
				22,
				9,
				10,
				22,
				10,
				17,
				17,
				10,
				24,
				17,
				24,
				16,
				5,
				20,
				11,
				20,
				5,
				7,
				7,
				5,
				4,
				7,
				4,
				6,
				6,
				4,
				2,
				6,
				2,
				18,
				18,
				2,
				29,
				18,
				29,
				31,
				20,
				13,
				11,
				13,
				20,
				23,
				13,
				23,
				27,
				27,
				23,
				19,
				27,
				19,
				28,
				28,
				19,
				18,
				28,
				18,
				31
			],
			roles: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				2,
				2,
				2,
				2,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			]
		}
	]
}.assets.map((e) => [e.id, e])), sa = .07;
function ca(e, t, n, r, i) {
	let a = oa.get(r.shape);
	if (!a) throw Error(`Unknown baked Kenney rock: ${r.shape}`);
	let o = e.length, s = Math.cos(r.turn), c = Math.sin(r.turn), l = a.size[1] * r.scale, u = /* @__PURE__ */ new Set();
	a.roles.forEach((e, t) => {
		if (e === 1) for (let e = 0; e < 3; e += 1) u.add(a.indices[t * 3 + e]);
	});
	for (let t = 0; t < a.positions.length / 3; t += 1) {
		let n = a.positions[t * 3] * r.scale, o = a.positions[t * 3 + 1] * r.scale, d = a.positions[t * 3 + 2] * r.scale;
		e.push({
			x: r.x + n * s - d * c,
			z: r.z + n * c + d * s,
			lift: o - l * sa,
			mass: i,
			turf: r.turf && u.has(t) ? 1 : 0,
			band: l > 0 ? o / l : 0
		});
	}
	for (let e = 0; e < a.roles.length; e += 1) {
		t.push([
			o + a.indices[e * 3],
			o + a.indices[e * 3 + 1],
			o + a.indices[e * 3 + 2]
		]);
		let i = a.roles[e];
		n.push(i === 1 ? +!!r.turf : i === 2 ? 2 : 0);
	}
}
var la = [
	{
		shape: "rock_tallA",
		x: -.14,
		z: .06,
		scale: 1,
		turn: .2,
		turf: !0
	},
	{
		shape: "rock_tallH",
		x: .43,
		z: -.2,
		scale: .95,
		turn: -.35,
		turf: !0
	},
	{
		shape: "rock_smallH",
		x: -.36,
		z: -.46,
		scale: 1.1,
		turn: .7,
		turf: !1
	},
	{
		shape: "rock_smallE",
		x: .3,
		z: .44,
		scale: 1.1,
		turn: -.9,
		turf: !0
	}
], ua = [], da = [], fa = [];
for (let [e, t] of la.entries()) ca(ua, da, fa, t, e);
var pa = ua, ma = da, ha = fa, ga = da.length, _a = new o.Color(8158082), va = new o.Color(11117466), ya = new o.Color(13880510), ba = new o.Color(8829258), xa = new o.Color(10931298);
function Sa(e, t, n = 0) {
	return t === 1 ? ba.clone().lerp(xa, .25 + n * .3) : t === 2 ? _a.clone() : e.band < .5 ? _a.clone().lerp(va, o.MathUtils.smoothstep(e.band, 0, .5)) : va.clone().lerp(ya, o.MathUtils.smoothstep(e.band, .55, 1));
}
var Ca = {
	large: [
		[
			{
				shape: "rock_tallA",
				x: -.2,
				z: .1,
				scale: 1.8,
				turn: .3,
				turf: !0
			},
			{
				shape: "rock_smallH",
				x: .7,
				z: -.55,
				scale: 1.6,
				turn: -.4,
				turf: !1
			},
			{
				shape: "rock_smallE",
				x: -.75,
				z: -.7,
				scale: 1.8,
				turn: 1.1,
				turf: !0
			}
		],
		[
			{
				shape: "rock_tallB",
				x: 0,
				z: .05,
				scale: 2,
				turn: -.5,
				turf: !0
			},
			{
				shape: "rock_tallC",
				x: .8,
				z: -.5,
				scale: 1.4,
				turn: .8,
				turf: !1
			},
			{
				shape: "rock_smallF",
				x: -.7,
				z: .75,
				scale: 1.6,
				turn: .2,
				turf: !0
			}
		],
		[{
			shape: "rock_largeD",
			x: 0,
			z: 0,
			scale: 1.85,
			turn: .9,
			turf: !0
		}, {
			shape: "rock_tallI",
			x: .75,
			z: -.6,
			scale: 1.3,
			turn: -.2,
			turf: !1
		}]
	],
	small: [[{
		shape: "rock_tallH",
		x: -.05,
		z: .05,
		scale: 1.85,
		turn: .5,
		turf: !0
	}, {
		shape: "rock_smallI",
		x: .45,
		z: -.35,
		scale: 1.2,
		turn: -.8,
		turf: !1
	}], [{
		shape: "rock_largeF",
		x: 0,
		z: 0,
		scale: 1.25,
		turn: -.3,
		turf: !0
	}, {
		shape: "rock_smallE",
		x: .4,
		z: .35,
		scale: 1.3,
		turn: 1.3,
		turf: !1
	}]],
	stone: [[{
		shape: "rock_smallTopB",
		x: 0,
		z: 0,
		scale: .95,
		turn: .4,
		turf: !0
	}], [{
		shape: "rock_smallH",
		x: -.04,
		z: .02,
		scale: 1.05,
		turn: -.6,
		turf: !0
	}, {
		shape: "rock_smallF",
		x: .26,
		z: -.12,
		scale: .55,
		turn: .9,
		turf: !1
	}]]
};
function wa(e) {
	return Ca[e].length;
}
function Ta(e, t, n) {
	return Math.floor(L(`${e}/${t.toFixed(2)}/${n.toFixed(2)}`) * Ca[e].length);
}
function Ea(e, t = 0) {
	return Da(Ca[e][t % Ca[e].length]);
}
function Da(e) {
	let t = [], n = [], r = [];
	for (let [i, a] of e.entries()) ca(t, n, r, a, i);
	let i = [], a = [];
	n.forEach((e, n) => {
		for (let o of e) {
			let e = t[o], s = Sa(e, r[n]);
			i.push(e.x, e.lift, e.z), a.push(s.r, s.g, s.b);
		}
	});
	let s = new o.BufferGeometry();
	return s.setAttribute("position", new o.Float32BufferAttribute(i, 3)), s.setAttribute("color", new o.Float32BufferAttribute(a, 3)), s.setIndex(Array.from({ length: i.length / 3 }, (e, t) => t)), s.computeVertexNormals(), s.computeBoundingBox(), s.computeBoundingSphere(), s;
}
function Oa(e) {
	let t = Math.cos(e.turn), n = Math.sin(e.turn), r = la.map((t, n) => Math.min(...ua.flatMap((t, r) => t.mass === n ? [e.groundHeights?.[r] ?? e.groundRange[0]] : [])));
	return ua.map((i) => ({
		x: e.x + (i.x * t - i.z * n) * e.radius,
		y: r[i.mass] + e.height * i.lift * (.9 + L(`${e.id ?? "bank"}/${i.mass}/lift`) * .1) - .02,
		z: e.z + (i.x * n + i.z * t) * e.radius
	}));
}
function ka(e, t, n) {
	let r = null;
	for (let [i, a, o] of da) {
		let s = e[i], c = e[a], l = e[o], u = (c.z - l.z) * (s.x - l.x) + (l.x - c.x) * (s.z - l.z);
		if (u >= -1e-12) continue;
		let d = ((c.z - l.z) * (t - l.x) + (l.x - c.x) * (n - l.z)) / u, f = ((l.z - s.z) * (t - l.x) + (s.x - l.x) * (n - l.z)) / u, p = 1 - d - f;
		if (Math.min(d, f, p) >= -1e-8) {
			let e = d * s.y + f * c.y + p * l.y;
			r = r === null ? e : Math.max(r, e);
		}
	}
	return r;
}
//#endregion
//#region src/island/course-outcrop-plan.ts
var Aa = {
	outcrops: 4,
	flora: 220,
	triangles: 5e4,
	outcropSides: 12,
	outcropTriangles: ga,
	groundEmbed: .16,
	ruinTriangles: 348
};
function ja(e, t, n, r = 12) {
	return Array.from({ length: r }, (i, a) => ({
		x: e + Math.cos(a * Math.PI * 2 / r) * n / Math.cos(Math.PI / r),
		z: t + Math.sin(a * Math.PI * 2 / r) * n / Math.cos(Math.PI / r)
	}));
}
function Ma(e, t) {
	let n = br(e), r = Qi(e), i = [], a = {
		field: 0,
		route: 0,
		nodes: 0,
		hero: 0,
		occupied: 0,
		coast: 0,
		acceptedCandidate: 0,
		relief: 0,
		unknownFootprints: t.filter((e) => !Number.isFinite(e.radius)).length
	}, o = Math.min(7.8, Math.max(2.7, e.bounds.maxHalf * .132)), s = e.lessonCount <= 8 ? 1 : e.lessonCount <= 24 ? 2 : 4, c = [], l = (i, s, l) => {
		let u = o * s, d = u * (.72 + L(`${e.seed}/terrace-height/${l}`) * .18), f = G(n, i.x, i.z);
		if (!f.inside || f.shore > .72 || f.rock > .82) {
			a.field++;
			return;
		}
		let p = Y(e, i);
		if (p < r + u + d * 1.4) {
			a.route++;
			return;
		}
		if (e.nodes.some((t) => Math.hypot(t.x - i.x, t.z - i.z) < u + d * 1.4 + e.route.nodeRadius)) {
			a.nodes++;
			return;
		}
		if (Math.hypot(e.hero.x - i.x, e.hero.z - i.z) < e.hero.radius + u + 1) {
			a.hero++;
			return;
		}
		if (t.some((e) => Math.hypot(e.x - i.x, e.z - i.z) < u + e.radius + .45)) {
			a.occupied++;
			return;
		}
		if (ja(i.x, i.z, u).some((e) => !G(n, e.x, e.z).inside)) {
			a.coast++;
			return;
		}
		a.acceptedCandidate++, c.push({
			point: i,
			radius: u,
			height: d,
			key: l,
			score: s * 4 + f.rock * 1.2 + f.grass * .35 - p * .025 + L(`${e.seed}/terrace/${l}`) * .6
		});
	};
	for (let t = 0; t < 32; t++) {
		let n = $i(e, (t + .5) / 32);
		if (n) for (let e of [
			1,
			.8,
			.64,
			.56
		]) for (let i of [-1, 1]) for (let a of [
			0,
			2.5,
			5,
			8
		]) {
			let s = r + o * e * 2.12 + .8 + a;
			l({
				x: n.point.x + n.baseNormal.x * s * i,
				z: n.point.z + n.baseNormal.z * s * i
			}, e, `route/${t}/${e}/${i}/${a}`);
		}
	}
	for (let t = -6; t <= 6; t++) for (let n = -6; n <= 6; n++) for (let r of [
		1,
		.8,
		.64
	]) l({
		x: t / 7 * e.bounds.halfX * .9,
		z: n / 7 * e.bounds.halfZ * .9
	}, r, `field/${t}/${n}/${r}`);
	c.sort((e, t) => t.score - e.score || e.key.localeCompare(t.key));
	for (let { point: t, radius: r, height: o, key: l } of c) {
		if (i.length >= s) break;
		if (i.some((e) => Math.hypot(e.x - t.x, e.z - t.z) < r + e.radius + 7)) continue;
		let c = ja(t.x, t.z, r), u = bi(e, c, "course");
		if (!u || u.maxY - u.minY > Math.min(o * .65, 1.8)) {
			a.relief++;
			continue;
		}
		let d = e.centerline.reduce((e, n) => Math.hypot(n.x - t.x, n.z - t.z) < Math.hypot(e.x - t.x, e.z - t.z) ? n : e, e.centerline[0]), f = c.reduce((t, n) => q(e, "course", n.x, n.z).y > q(e, "course", t.x, t.z).y ? n : t, c[0]), p = {
			x: t.x - d.x,
			z: t.z - d.z
		}, m = Math.hypot(p.x, p.z) > .01 ? Math.atan2(p.z, p.x) : Math.atan2(f.z - t.z, f.x - t.x);
		i.push({
			...t,
			id: `outcrop/${l}`,
			feature: i.length === 1 && e.themeSelection.accentPackIds.includes("fantasy-town-kit") ? "ruin" : "buttress",
			radius: r,
			height: o,
			baseY: u.minY - Aa.groundEmbed,
			groundRange: [u.minY, u.maxY],
			footprint: c,
			turn: i.length === 1 && e.themeSelection.accentPackIds.includes("fantasy-town-kit") ? Math.atan2(t.x - d.x, d.z - t.z) : m,
			meadow: G(n, t.x, t.z).grass,
			groundHeights: pa.map((n) => q(e, "course", t.x + (n.x * Math.cos(m) - n.z * Math.sin(m)) * r, t.z + (n.x * Math.sin(m) + n.z * Math.cos(m)) * r).y)
		});
	}
	return {
		outcrops: i,
		search: a
	};
}
//#endregion
//#region src/island/course-spring-plan.ts
var Na = 1600;
function Pa(e, t, n) {
	if (![
		e,
		t,
		n
	].every(Number.isFinite) || t > n) return null;
	let r = Math.min(e, t + .24);
	return r >= n + .005 && r - t <= .26 ? r : null;
}
function Fa(e, t, n) {
	return Math.hypot(t.x - e.basin.x, t.z - e.basin.z) < e.basin.radius * 1.18 + n || e.channel.some((e) => Math.hypot(t.x - e.x, t.z - e.z) < e.halfWidth + .32 + n);
}
function Ia(e, t) {
	if (e.lessonCount < 12 || t.some((e) => !Number.isFinite(e.radius))) return null;
	let n = Qi(e), r = Math.min(2.1, Math.max(1.25, e.bounds.maxHalf * .053)), i = (r, i) => Y(e, r) >= n + i + .25 && Math.hypot(r.x - e.hero.x, r.z - e.hero.z) >= e.hero.radius + i && e.nodes.every((t) => Math.hypot(t.x - r.x, t.z - r.z) >= e.route.nodeRadius + i + .35) && t.every((e) => Math.hypot(e.x - r.x, e.z - r.z) >= i + e.radius + .2), a = e.outline.filter((e, t) => t % 3 == 0).map((t, n) => {
		let r = Math.hypot(t.x, t.z);
		return {
			point: t,
			id: n,
			score: t.x / r + t.z / r * .45 + L(`${e.seed}/spring/${n}`) * .08
		};
	}).sort((e, t) => t.score - e.score || e.id - t.id);
	for (let t of a) for (let n of [
		1,
		.82,
		.68
	]) {
		let a = r * n, o = Math.hypot(t.point.x, t.point.z), s = {
			x: t.point.x / o,
			z: t.point.z / o
		}, c = t.point.x - s.x * (a * 1.3 + 1.2), l = t.point.z - s.z * (a * 1.3 + 1.2), u = ja(c, l, a * 1.18, 16);
		if (!i({
			x: c,
			z: l
		}, a * 1.18) || u.some((t) => !Nn(t, e.outline))) continue;
		let d = bi(e, u, "course");
		if (!d || d.maxY - d.minY > .2) continue;
		let f = {
			x: c,
			z: l,
			radius: a,
			halfWidth: a,
			y: d.maxY + .05,
			groundRange: [d.minY, d.maxY]
		}, p = a * .29, m = [], h = f.y, g = !1, _ = !1;
		for (let t = 0; t < 32; t++) {
			let n = a * .67 + t * .3, r = {
				x: c + s.x * n,
				z: l + s.z * n
			}, o = p + .16;
			if ([
				-1,
				0,
				1
			].map((e) => ({
				x: r.x - s.z * o * e,
				z: r.z + s.x * o * e
			})).map((t) => q(e, "course", t.x, t.z)).some((e) => !e.inside)) {
				_ = !0;
				break;
			}
			if (!i(r, o + .15)) {
				g = !0;
				break;
			}
			let u = [-1, 1].flatMap((e) => [-1, 1].map((t) => ({
				x: r.x + s.x * e * .15 - s.z * o * t,
				z: r.z + s.z * e * .15 + s.x * o * t
			})));
			[u[2], u[3]] = [u[3], u[2]];
			let d = bi(e, u, "course");
			if (!d) {
				_ = !0;
				break;
			}
			let f = d.minY, v = d.maxY, y = Pa(h, f, v);
			if (y === null) {
				g = !0;
				break;
			}
			m.push({
				...r,
				y,
				halfWidth: p,
				groundRange: [f, v]
			}), h = y;
		}
		let v = m.at(-1);
		if (g || !_ || !v || m.length < 3) continue;
		let y = null;
		for (let t of [
			.3,
			.6,
			.9,
			1.2,
			1.5
		]) {
			let n = {
				x: v.x + s.x * t,
				z: v.z + s.z * t
			}, r = [
				-1,
				0,
				1
			].map((e) => ({
				x: n.x - s.z * p * e,
				z: n.z + s.x * p * e
			}));
			if (r.map((t) => q(e, "course", t.x, t.z)).some((e) => e.inside && e.y > v.y - .005)) break;
			if (r.every((t) => !Nn(t, e.outline))) {
				y = n;
				break;
			}
		}
		if (y) return {
			id: `spring/coast/${t.id}/${n}`,
			basin: f,
			direction: s,
			channel: m,
			lip: y,
			drop: Math.min(18, Math.max(6, e.underside.depth * .48))
		};
	}
	return null;
}
//#endregion
//#region src/island/foliage-tone.ts
var La = {
	moss: 7117137,
	jade: 5344872,
	dryGold: 10917972
};
function Ra(e) {
	return Math.max(0, Math.min(1, e));
}
function za(e, t, n) {
	let r = Ra(n), i = (n) => Math.round((e >> n & 255) * (1 - r) + (t >> n & 255) * r);
	return i(16) << 16 | i(8) << 8 | i(0);
}
function Ba(e, t) {
	let n = Ra(e.grass), r = Ra(e.rock), i = Ra(e.height / Math.max(1, t)), a = Ra(n * .88 + (1 - e.ao) * .18 - r * .35), o = Ra(r * 1.65 + i * .35 - n * .25) ** 3 * .68;
	return za(za(La.moss, La.jade, a), La.dryGold, o);
}
function Va(e, t) {
	return Ba(G(e, t.x, t.z), e.extent * .14);
}
//#endregion
//#region src/island/course-tree-envelope.ts
function Ha(e, t, n) {
	return L(`${e}/tree-form/${t.toFixed(3)}/${n.toFixed(3)}`) < .56;
}
var Ua = 32, Wa = /* @__PURE__ */ new Map();
function Ga(e) {
	let t = Wa.get(e);
	if (t) return t;
	let n = U(e, "course"), r = new Float32Array(Ua);
	try {
		let e = n.getAttribute("position"), t = n.index;
		for (let n = 0; n < t.count; n += 3) {
			let i = [
				t.getX(n),
				t.getX(n + 1),
				t.getX(n + 2)
			], a = Math.max(0, Math.floor(Math.min(...i.map((t) => e.getY(t))) * Ua)), o = Math.min(31, Math.floor(Math.max(...i.map((t) => e.getY(t))) * Ua)), s = Math.max(...i.map((t) => Math.hypot(e.getX(t), e.getZ(t)))) + 1e-6;
			for (let e = a; e <= o; e++) r[e] = Math.max(r[e], s);
		}
	} finally {
		n.dispose();
	}
	return Wa.set(e, r), r;
}
function Ka(e, t) {
	let n = Math.hypot(e.x - t.x, e.z - t.z);
	if (n > (e.height + t.height) * .45 + .04) return !0;
	let r = Ga(e.form), i = Ga(t.form);
	for (let a = 0; a < Ua; a++) {
		let o = e.y + a * e.height / Ua, s = o + e.height / Ua, c = Math.max(0, Math.floor((o - t.y) / t.height * Ua)), l = Math.min(31, Math.floor((s - t.y) / t.height * Ua));
		for (let o = c; o <= l; o++) if (n < r[a] * e.height + i[o] * t.height + .04) return !1;
	}
	return !0;
}
function qa(e, t, n, r) {
	if (e.lessonCount <= 12) return [];
	let i = e.lessonCount > 24 ? 2 : 1, a = [], o = Qi(e);
	for (let i = -5; i <= 5; i++) for (let s = -5; s <= 5; s++) {
		let c = i / 7 * e.bounds.halfX, l = s / 7 * e.bounds.halfZ, u = G(t, c, l), d = {
			x: c,
			z: l
		};
		if (!u.inside || u.shore > .7 || u.rock > .32 || u.grass < .3) continue;
		let f = Y(e, d);
		f < o + 10 || f > e.bounds.maxHalf * .6 || r.some((e) => Math.hypot(e.x - c, e.z - l) < 12) || n.some((e) => Math.hypot(e.x - c, e.z - l) < e.radius + 6) || Math.hypot(e.hero.x - c, e.hero.z - l) < e.hero.radius + 7 || [
			[-4, -4],
			[4, -4],
			[4, 4],
			[-4, 4]
		].every(([n, r]) => {
			let i = {
				x: c + n,
				z: l + r
			}, a = G(t, i.x, i.z);
			return a.inside && a.shore < .82 && Y(e, i) > o + 4;
		}) && a.push({
			x: c,
			z: l,
			score: u.grass * 1.4 - u.rock * 1.1 + u.height / e.bounds.maxHalf * .9
		});
	}
	a.sort((e, t) => t.score - e.score || e.x - t.x || e.z - t.z);
	let s = [];
	for (let t of a) {
		if (s.length >= i) break;
		if (s.some((e) => Math.hypot(e.x - t.x, e.z - t.z) < 14)) continue;
		let n = e.centerline.reduce((e, n) => Math.hypot(n.x - t.x, n.z - t.z) < Math.hypot(e.x - t.x, e.z - t.z) ? n : e, e.centerline[0]), r = $i(e, n.t);
		if (!r) continue;
		let a = Math.sign((t.x - r.point.x) * r.baseNormal.x + (t.z - r.point.z) * r.baseNormal.z) || 1;
		s.push({
			x: t.x,
			z: t.z,
			routeFraction: n.t,
			side: a,
			tangent: r.tangent,
			normal: {
				x: r.baseNormal.x * a,
				z: r.baseNormal.z * a
			}
		});
	}
	return s;
}
function Ja(e) {
	return e.bounds.maxHalf >= 36 ? 1 : Math.min(1, Math.max(.35, e.bounds.maxHalf / 43));
}
function Ya(e, t, n, r) {
	let i = Qi(e), a = Ja(e), o = (e, t) => Math.max(t, e * a), s = o(3.5, 2), c = (e, n) => {
		let r = G(t, e, n);
		return r.inside && r.shore <= .8 && r.rock <= .32 && r.grass >= .3 ? r : null;
	}, l = n.filter((e) => e.kind === "tree"), u = (e, t) => l.reduce((n, r) => Math.min(n, Math.hypot(r.x - e, r.z - t)), Infinity), d = 0;
	for (let t = -e.bounds.halfX; t <= e.bounds.halfX; t += 1) for (let n = -e.bounds.halfZ; n <= e.bounds.halfZ; n += 1) c(t, n) && Y(e, {
		x: t,
		z: n
	}) >= i + s && u(t, n) >= o(3.5, 2) && (d += 1);
	let f = Math.min(16, Math.floor(d / Math.max(40, 60 * a * a)));
	if (f === 0) return [];
	let p = [];
	for (let a = -10; a <= 10; a++) for (let l = -10; l <= 10; l++) {
		let d = a / 14 * e.bounds.halfX, f = l / 14 * e.bounds.halfZ, m = c(d, f);
		if (!m || Y(e, {
			x: d,
			z: f
		}) < i + s || r.some((e) => Math.hypot(e.x - d, e.z - f) < o(5.5, 3)) || n.some((e) => Math.hypot(e.x - d, e.z - f) < e.radius + o(3, 1.5)) || Math.hypot(e.hero.x - d, e.hero.z - f) < e.hero.radius + o(7, 3)) continue;
		let h = o(3, 1.5);
		[
			[-h, -h],
			[h, -h],
			[h, h],
			[-h, h]
		].every(([n, r]) => {
			let a = G(t, d + n, f + r);
			return a.inside && a.shore < .86 && Y(e, {
				x: d + n,
				z: f + r
			}) > i + h;
		}) && p.push({
			x: d,
			z: f,
			score: m.grass * 1.4 - m.rock * 1.1 + Math.min(u(d, f), 12) * .08
		});
	}
	p.sort((e, t) => t.score - e.score || e.x - t.x || e.z - t.z);
	let m = [];
	for (let t of p) {
		if (m.length >= f) break;
		if (m.some((e) => Math.hypot(e.x - t.x, e.z - t.z) < o(10, 5))) continue;
		let n = e.centerline.reduce((e, n) => Math.hypot(n.x - t.x, n.z - t.z) < Math.hypot(e.x - t.x, e.z - t.z) ? n : e, e.centerline[0]), r = $i(e, n.t);
		if (!r) continue;
		let i = Math.sign((t.x - r.point.x) * r.baseNormal.x + (t.z - r.point.z) * r.baseNormal.z) || 1;
		m.push({
			x: t.x,
			z: t.z,
			routeFraction: n.t,
			side: i,
			tangent: r.tangent,
			normal: {
				x: r.baseNormal.x * i,
				z: r.baseNormal.z * i
			}
		});
	}
	return m;
}
var Xa = [
	{
		id: "castle-kit",
		folder: "kenney_castle-kit",
		title: "Castle Kit",
		version: "2.0",
		licenseSha256: "aac944f18106b3a3e29c6fdeec02523d4cab4c735abc01f5a8fa88a79ae173ef",
		glbCount: 76,
		glbBytes: 2080872,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "fantasy-town-kit",
		folder: "kenney_fantasy-town-kit_2.0",
		title: "Fantasy Town Kit",
		version: "2.0",
		licenseSha256: "fb8e4817197ef9f62215e95b4451a0f09c769c8e03e416e3a2ce108dfa6117e4",
		glbCount: 167,
		glbBytes: 2497400,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "graveyard-kit",
		folder: "kenney_graveyard-kit_5.0",
		title: "Graveyard Kit",
		version: "5.0",
		licenseSha256: "a48e274258386c6bcb5302f17eaab40304cd805cc68be2754e2452179418c70e",
		glbCount: 91,
		glbBytes: 3350032,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "holiday-kit",
		folder: "kenney_holiday-kit",
		title: "Holiday Kit",
		version: "2.0",
		licenseSha256: "6010f677d95f3ab7935faf873d8f4eb96ad1e5f02fd0e4659c9d92852b768d6a",
		glbCount: 99,
		glbBytes: 2751544,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "mini-arena",
		folder: "kenney_mini-arena",
		title: "Mini Arena",
		version: "1.1",
		licenseSha256: "f90537c9edc22b1e4cb65ae43ae9d784b2479a614b4bf75a7ea796822fe288e0",
		glbCount: 22,
		glbBytes: 510916,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png",
		additionalCredits: ["Tony Schär"]
	},
	{
		id: "mini-dungeon",
		folder: "kenney_mini-dungeon",
		title: "Mini Dungeon",
		version: "2.0",
		licenseSha256: "f8b470068a1c043854101c9ff7161d376ba02c36239da3c1dbdfa928b08444b6",
		glbCount: 30,
		glbBytes: 897568,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "mini-forest",
		folder: "kenney_mini-forest_1.0",
		title: "Mini Forest",
		version: "1.0",
		licenseSha256: "0629109f3ab090d569835d035c5a1f90fc0b76727bec28b128a5b4c1d35dd8c2",
		glbCount: 22,
		glbBytes: 838760,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "mini-skate",
		folder: "kenney_mini-skate",
		title: "Mini Skate",
		version: "1.2",
		licenseSha256: "6a075a1edb319f16d86cb6b9065436ce89dd851c234704ad160b4255b85e1b67",
		glbCount: 20,
		glbBytes: 566536,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "minigolf-kit",
		folder: "kenney_minigolf-kit",
		title: "Minigolf Kit",
		version: "3.1",
		licenseSha256: "1921de0377e3912e14fd2b9c76f92c530bd63794caabc3e411b97672d5a3951c",
		glbCount: 126,
		glbBytes: 1943700,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "modular-cave-kit",
		folder: "kenney_modular-cave-kit_1.0",
		title: "Modular Cave Kit",
		version: "1.0",
		licenseSha256: "0889f6cf5c972b42de634c2f1f8bec37d92e8d65acf28830afb159c04e3c6954",
		glbCount: 40,
		glbBytes: 6235348,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "modular-dungeon-kit",
		folder: "kenney_modular-dungeon-kit_1.0",
		title: "Modular Dungeon Kit",
		version: "2.1",
		licenseSha256: "41a49bdd304040502cabcedf73f27a1beeecc548c86f71822f288600d39d2601",
		glbCount: 39,
		glbBytes: 7403776,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "modular-space-kit",
		folder: "kenney_modular-space-kit_1.0",
		title: "Modular Space Kit",
		version: "1.0",
		licenseSha256: "38d94a4c79768cf5dc65e55b85f2dedd9f4bad35e325db1d0e5898fc1b7c5bbb",
		glbCount: 40,
		glbBytes: 8070500,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "nature-kit",
		folder: "kenney_nature-kit",
		title: "Nature Kit",
		version: "2.1",
		licenseSha256: "cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d",
		glbCount: 329,
		glbBytes: 3034380,
		materialMode: "unlit-color",
		textureDependency: "none"
	},
	{
		id: "pirate-kit",
		folder: "kenney_pirate-kit",
		title: "Pirate Kit",
		version: "2.1",
		licenseSha256: "5e99246a5a65fa3420a1a1c7a8616f096202c78866f73d7aacfe73c0aab0ca36",
		glbCount: 72,
		glbBytes: 3011576,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "platformer-kit",
		folder: "kenney_platformer-kit",
		title: "Platformer Kit",
		version: "4.1",
		licenseSha256: "e1185354d8f0f055c325c7204602326c8cf0c47ee5ae1db7ed16f0465b91bb9a",
		glbCount: 153,
		glbBytes: 3210960,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "space-kit",
		folder: "kenney_space-kit",
		title: "Space Kit",
		version: "2.0",
		licenseSha256: "bd4e050e69d41351282c4d53f943cd4d80a80b968593e60653ba5292637941b7",
		glbCount: 153,
		glbBytes: 2014920,
		materialMode: "unlit-color",
		textureDependency: "none"
	},
	{
		id: "space-station-kit",
		folder: "kenney_space-station-kit",
		title: "Space Station Kit",
		version: "1.0",
		licenseSha256: "e8de83b5cb2f01810e32f07691cb1dcf9494dc4a7f8cce0ec8175dfb8c5d98d9",
		glbCount: 97,
		glbBytes: 984788,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "survival-kit",
		folder: "kenney_survival-kit",
		title: "Survival Kit",
		version: "2.0",
		licenseSha256: "62c8356876481204fa4d40dc59183dfed777adf987d7f2a1390fffe8a699f3ff",
		glbCount: 80,
		glbBytes: 1298392,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "tower-defense-kit",
		folder: "kenney_tower-defense-kit",
		title: "Tower Defense Kit",
		version: "2.1",
		licenseSha256: "9f08295a8b8245eb9b82ace4226176a9bddb677638cdd564d21c554c4651720a",
		glbCount: 160,
		glbBytes: 5754580,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	},
	{
		id: "watercraft-pack",
		folder: "kenney_watercraft-pack",
		title: "Watercraft Pack",
		version: "2.1",
		licenseSha256: "f5f520f81277128fb422aebe334d2f08e6d8e5f7face6008885d8ff920253724",
		glbCount: 46,
		glbBytes: 1947372,
		materialMode: "external-colormap",
		textureDependency: "Textures/colormap.png"
	}
].map((e) => ({ ...e })), Za = {
	packId: "nature-kit",
	roleIds: ["rock", "cliff"],
	assetIds: ["rock_largeA", "rock_smallA"],
	naturalAssets: {
		tree: {
			packId: "elemental-serenity",
			assetId: "treeTrunks"
		},
		bush: {
			packId: "elemental-serenity",
			assetId: "bushEmitter"
		},
		rocks: [{
			packId: "nature-kit",
			assetId: "rock_largeA"
		}, {
			packId: "nature-kit",
			assetId: "rock_smallA"
		}]
	},
	proceduralTerrain: !0
}, Qa = [
	{
		id: "R01-forest-academy",
		base: Za,
		accentPackIds: ["fantasy-town-kit"],
		accentRoles: [{
			packId: "fantasy-town-kit",
			assetIds: [
				"wall",
				"wall-corner",
				"wall-doorway-square",
				"roof",
				"roof-gable",
				"fountain-round",
				"stall",
				"lantern",
				"stall-bench",
				"cart"
			],
			visualWeight: "primary",
			zone: "center"
		}],
		paletteId: "sunlit-meadow",
		courseMood: "基础 / 入门",
		candidateCharacters: [{
			source: "shared-avatar",
			assetIds: [],
			role: "player"
		}],
		excluded: [
			{
				packId: "space-kit",
				reason: "留给独立星港岛，避免首岛风格跳变"
			},
			{
				packId: "modular-space-kit",
				reason: "留给独立星港岛，避免首岛风格跳变"
			},
			{
				packId: "pirate-kit",
				reason: "港口语义不属于首岛"
			},
			{
				packId: "watercraft-pack",
				reason: "港口语义不属于首岛"
			}
		],
		rawGlbBudget: 12
	},
	{
		id: "R02-river-market",
		base: Za,
		accentPackIds: ["fantasy-town-kit", "watercraft-pack"],
		accentRoles: [{
			packId: "fantasy-town-kit",
			assetIds: [
				"stall",
				"cart",
				"watermill"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "watercraft-pack",
			assetIds: [
				"boat-house-a",
				"boat-row-small",
				"buoy",
				"cargo-container-a"
			],
			visualWeight: "secondary",
			zone: "shore"
		}],
		paletteId: "river-market",
		courseMood: "沟通 / 现实案例",
		candidateCharacters: [{
			source: "shared-avatar",
			assetIds: [],
			role: "player"
		}],
		excluded: [{
			packId: "pirate-kit",
			reason: "海盗语义会抢走市集焦点"
		}],
		rawGlbBudget: 18
	},
	{
		id: "R03-starport",
		base: Za,
		accentPackIds: ["space-kit", "modular-space-kit"],
		accentRoles: [{
			packId: "modular-space-kit",
			assetIds: [
				"gate",
				"corridor-intersection",
				"platform-large"
			],
			visualWeight: "primary",
			zone: "rim"
		}, {
			packId: "space-kit",
			assetIds: [
				"satelliteDish_large",
				"machine_generatorLarge",
				"rover"
			],
			visualWeight: "secondary",
			zone: "underside"
		}],
		paletteId: "cyan-orbit",
		courseMood: "系统 / 架构",
		logicalFamily: "sci-fi",
		candidateCharacters: [{
			source: "kenney",
			assetIds: [
				"astronautA",
				"astronautB",
				"alien",
				"rover"
			],
			role: "mascot"
		}],
		excluded: [{
			packId: "space-station-kit",
			reason: "轨道实验室使用"
		}],
		rawGlbBudget: 18
	},
	{
		id: "R04-orbital-lab",
		base: Za,
		accentPackIds: ["space-station-kit", "modular-space-kit"],
		accentRoles: [{
			packId: "space-station-kit",
			assetIds: [
				"wall",
				"floor",
				"pipe"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "modular-space-kit",
			assetIds: [
				"room",
				"corridor",
				"gate-lasers"
			],
			visualWeight: "secondary",
			zone: "rim"
		}],
		paletteId: "laboratory-blue",
		courseMood: "研究 / 阅读",
		logicalFamily: "sci-fi",
		candidateCharacters: [{
			source: "shared-avatar",
			assetIds: [],
			role: "player"
		}],
		excluded: [{
			packId: "space-kit",
			reason: "星港使用"
		}],
		rawGlbBudget: 16
	},
	{
		id: "R05-border-observatory",
		base: Za,
		accentPackIds: ["tower-defense-kit", "space-kit"],
		accentRoles: [{
			packId: "tower-defense-kit",
			assetIds: ["tower", "detail-crystal"],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "space-kit",
			assetIds: [
				"rover",
				"enemy-ufo-a",
				"enemy-ufo-b"
			],
			visualWeight: "secondary",
			zone: "distant"
		}],
		paletteId: "watch-post",
		courseMood: "监控 / 调试",
		candidateCharacters: [{
			source: "kenney",
			assetIds: [
				"rover",
				"astronautA",
				"alien"
			],
			role: "drone"
		}],
		excluded: [{
			packId: "modular-space-kit",
			reason: "避免与星港结构重复"
		}],
		rawGlbBudget: 16
	},
	{
		id: "R06-forest-fortress",
		base: Za,
		accentPackIds: ["castle-kit", "mini-forest"],
		accentRoles: [{
			packId: "castle-kit",
			assetIds: [
				"wall",
				"tower",
				"gate"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "mini-forest",
			assetIds: [
				"bridge",
				"tent",
				"character-archer"
			],
			visualWeight: "secondary",
			zone: "shore"
		}],
		paletteId: "moss-fortress",
		courseMood: "规划 / 里程碑",
		candidateCharacters: [{
			source: "kenney",
			assetIds: ["character-archer"],
			role: "npc"
		}],
		excluded: [{
			packId: "fantasy-town-kit",
			reason: "避免与首岛人居锚点重复"
		}],
		rawGlbBudget: 18
	},
	{
		id: "R07-training-arena",
		base: Za,
		accentPackIds: ["mini-arena", "platformer-kit"],
		accentRoles: [{
			packId: "mini-arena",
			assetIds: [
				"floor",
				"wall",
				"statue"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "platformer-kit",
			assetIds: ["platform", "marker"],
			visualWeight: "secondary",
			zone: "rim"
		}],
		paletteId: "practice-coral",
		courseMood: "练习 / 反馈",
		candidateCharacters: [{
			source: "kenney",
			assetIds: ["character-soldier", "character-oobi"],
			role: "mascot"
		}],
		excluded: [{
			packId: "minigolf-kit",
			reason: "花园运动岛使用"
		}],
		rawGlbBudget: 16
	},
	{
		id: "R08-ancient-cavern",
		base: Za,
		accentPackIds: ["modular-dungeon-kit", "mini-dungeon"],
		accentRoles: [{
			packId: "modular-dungeon-kit",
			assetIds: [
				"room",
				"corridor",
				"door"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "mini-dungeon",
			assetIds: [
				"torch",
				"chest",
				"character-human"
			],
			visualWeight: "secondary",
			zone: "distant"
		}],
		paletteId: "deep-amber",
		courseMood: "深层基础 / 复杂性",
		candidateCharacters: [{
			source: "kenney",
			assetIds: ["character-human", "character-orc"],
			role: "npc"
		}],
		excluded: [{
			packId: "graveyard-kit",
			reason: "墓园洞窟使用"
		}],
		rawGlbBudget: 14
	},
	{
		id: "R09-grave-cavern",
		base: Za,
		accentPackIds: ["graveyard-kit", "modular-cave-kit"],
		accentRoles: [{
			packId: "graveyard-kit",
			assetIds: [
				"crypt",
				"gravestone",
				"keeper"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "modular-cave-kit",
			assetIds: ["room", "gate-rock"],
			visualWeight: "secondary",
			zone: "rim"
		}],
		paletteId: "violet-memory",
		courseMood: "回顾 / 记忆",
		candidateCharacters: [{
			source: "kenney",
			assetIds: ["character-keeper", "character-ghost"],
			role: "mascot"
		}],
		excluded: [{
			packId: "modular-dungeon-kit",
			reason: "古洞窟使用"
		}],
		rawGlbBudget: 14
	},
	{
		id: "R10-bay-harbour",
		base: Za,
		accentPackIds: ["pirate-kit", "watercraft-pack"],
		accentRoles: [{
			packId: "pirate-kit",
			assetIds: [
				"dock",
				"tower",
				"ship"
			],
			visualWeight: "primary",
			zone: "shore"
		}, {
			packId: "watercraft-pack",
			assetIds: ["boat-row-small", "cargo-container-a"],
			visualWeight: "secondary",
			zone: "distant"
		}],
		paletteId: "harbour-teal",
		courseMood: "协作 / 交换",
		candidateCharacters: [{
			source: "shared-avatar",
			assetIds: [],
			role: "player"
		}],
		excluded: [{
			packId: "fantasy-town-kit",
			reason: "避免与河谷市集重复"
		}],
		rawGlbBudget: 16
	},
	{
		id: "R11-snow-camp",
		base: Za,
		accentPackIds: ["holiday-kit", "survival-kit"],
		accentRoles: [{
			packId: "holiday-kit",
			assetIds: [
				"cabin",
				"snow",
				"lights"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "survival-kit",
			assetIds: [
				"tent",
				"campfire",
				"resource"
			],
			visualWeight: "secondary",
			zone: "shore"
		}],
		paletteId: "winter-sun",
		courseMood: "季节性韧性 / 运营",
		candidateCharacters: [{
			source: "kenney",
			assetIds: [
				"snowman",
				"reindeer",
				"gingerbread"
			],
			role: "mascot"
		}],
		excluded: [{
			packId: "graveyard-kit",
			reason: "避免阴暗语义冲突"
		}],
		rawGlbBudget: 16
	},
	{
		id: "R12-garden-sports",
		base: Za,
		accentPackIds: ["minigolf-kit", "mini-skate"],
		accentRoles: [{
			packId: "minigolf-kit",
			assetIds: [
				"spline",
				"ramp",
				"flag"
			],
			visualWeight: "primary",
			zone: "center"
		}, {
			packId: "mini-skate",
			assetIds: ["rail", "half-pipe"],
			visualWeight: "secondary",
			zone: "rim"
		}],
		paletteId: "garden-citrus",
		courseMood: "实验 / 安全失败",
		candidateCharacters: [{
			source: "kenney",
			assetIds: ["character-skate-boy", "character-skate-girl"],
			role: "mascot"
		}],
		excluded: [{
			packId: "platformer-kit",
			reason: "竞技训练场使用"
		}],
		rawGlbBudget: 16
	}
];
function $a(e) {
	let t = [];
	e.base.packId !== "nature-kit" && t.push("base.packId must be nature-kit"), e.base.proceduralTerrain !== !0 && t.push("base.proceduralTerrain must be true"), e.base.assetIds.length === 0 && t.push("base.assetIds must not be empty"), new Set(e.base.assetIds).size !== e.base.assetIds.length && t.push("base.assetIds must be unique");
	let n = [
		e.base.naturalAssets.tree,
		e.base.naturalAssets.bush,
		...e.base.naturalAssets.rocks
	];
	e.base.naturalAssets.rocks.length === 0 && t.push("base.naturalAssets.rocks must not be empty");
	for (let e of n) e.assetId || t.push("base.naturalAssets assetId must not be empty"), e.packId !== "nature-kit" && e.packId !== "elemental-serenity" && t.push(`unknown natural pack: ${e.packId}`);
	(e.accentPackIds.length < 1 || e.accentPackIds.length > 2) && t.push("accentPackIds must contain one or two physical packs"), new Set(e.accentPackIds).size !== e.accentPackIds.length && t.push("accentPackIds must be unique"), e.accentPackIds.includes("nature-kit") && t.push("nature-kit is a base pack, not an accent pack");
	let r = new Set(Xa.map((e) => e.id));
	for (let n of e.accentPackIds) r.has(n) || t.push(`unknown accent pack: ${n}`);
	for (let n of e.accentRoles) e.accentPackIds.includes(n.packId) || t.push(`accent role ${n.assetIds.join(",")} uses an unselected pack`), n.assetIds.length === 0 && t.push(`accent role for ${n.packId} has no assets`);
	for (let n of e.accentPackIds) e.accentRoles.some((e) => e.packId === n) || t.push(`selected accent pack ${n} has no role`);
	let i = /* @__PURE__ */ new Set([...e.base.assetIds, ...e.accentRoles.flatMap((e) => e.assetIds)]);
	return !Number.isInteger(e.rawGlbBudget) || e.rawGlbBudget < 1 ? t.push("rawGlbBudget must be a positive integer") : i.size > e.rawGlbBudget && t.push(`recipe selects ${i.size} assets over budget ${e.rawGlbBudget}`), {
		ok: t.length === 0,
		errors: t
	};
}
function eo(e) {
	return Qa.find((t) => t.id === e);
}
Xa.map((e) => {
	let t = [], n = /* @__PURE__ */ new Set();
	for (let r of Qa) e.id === r.base.packId && (t.push(r.id), r.base.assetIds.forEach((e) => n.add(e))), r.accentPackIds.includes(e.id) && (t.push(r.id), r.accentRoles.filter((t) => t.packId === e.id).flatMap((e) => e.assetIds).forEach((e) => n.add(e)));
	let r = [...n].sort();
	return {
		packId: e.id,
		recipeIds: [...new Set(t)],
		selectedAssetIds: r,
		selectedCount: r.length,
		totalGlbCount: e.glbCount,
		coverageRatio: r.length / e.glbCount,
		status: e.id === "nature-kit" || e.id === "fantasy-town-kit" ? "validated" : t.length > 0 ? "represented" : "unseen",
		licenseSha256: e.licenseSha256
	};
});
//#endregion
//#region src/island/island-composition.ts
var to = {
	wall: {
		x: .1,
		y: 1,
		z: 1
	},
	"wall-doorway-square": {
		x: .1,
		y: 1,
		z: 1
	},
	"wall-corner": {
		x: 1,
		y: 1,
		z: 1
	},
	roof: {
		x: 1.0671,
		y: .6483,
		z: 1
	},
	"roof-gable": {
		x: 1.1,
		y: .5707,
		z: 1.0707
	},
	camp: {
		x: 2.696,
		y: .7302,
		z: 2.5027
	},
	tent: {
		x: 4.9921,
		y: 4.8199,
		z: 7.213
	},
	bridge: {
		x: 11.0779,
		y: 3.5854,
		z: 5.0736
	},
	"fountain-round": {
		x: 2,
		y: .28,
		z: 2
	},
	stall: {
		x: .65,
		y: .3655,
		z: 1
	},
	"stall-bench": {
		x: .26,
		y: .2255014,
		z: .94
	},
	cart: {
		x: .8930242,
		y: .5355014,
		z: 1.34
	},
	lantern: {
		x: .2164,
		y: 1.556,
		z: .2243
	},
	rock_largeA: {
		x: .7849,
		y: .2598,
		z: 1.0155
	},
	rock_smallA: {
		x: .3608,
		y: .1912,
		z: .3608
	}
}, no = 2.3, ro = no / to.wall.y, io = "elemental-serenity", ao = {
	camp: {
		height: .32,
		state: "lit"
	},
	tent: { height: 1.95 },
	academyWall: { height: no },
	academyRoof: {
		height: to.roof.y * ro,
		lift: no
	},
	academyRoofGable: {
		height: to["roof-gable"].y * ro,
		lift: no
	},
	bridge: { height: 1.14 }
}, oo = .22, so = .12, co = .38, lo = .22, uo = .22, fo = .32, po = .18, mo = .45, ho = 9.2;
function go(e) {
	return e in to ? to[e] : null;
}
function _o(e, t) {
	let n = go(e);
	if (!n) {
		let e = Math.max(.4, t * .45);
		return {
			x: e,
			y: t,
			z: e
		};
	}
	let r = t / n.y;
	return {
		x: n.x * r,
		y: t,
		z: n.z * r
	};
}
function vo(e, t, n, r, i) {
	let a = _o(e, t);
	return {
		x: n,
		z: r,
		halfX: a.x * .5,
		halfZ: a.z * .5,
		turn: i
	};
}
function yo(e, t, n) {
	let r = Math.cos(n), i = Math.sin(n);
	return {
		x: e * r + t * i,
		z: -e * i + t * r
	};
}
function bo(e) {
	return [
		[0, 0],
		[-e.halfX, -e.halfZ],
		[e.halfX, -e.halfZ],
		[e.halfX, e.halfZ],
		[-e.halfX, e.halfZ],
		[0, -e.halfZ],
		[0, e.halfZ],
		[-e.halfX, 0],
		[e.halfX, 0]
	].map(([t, n]) => {
		let r = yo(t, n, e.turn);
		return {
			x: e.x + r.x,
			z: e.z + r.z
		};
	});
}
function xo(e) {
	return Math.hypot(e.halfX, e.halfZ);
}
function So(e) {
	if (e.length === 0) return 0;
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 == 1 ? t[n] : (t[n - 1] + t[n]) * .5;
}
function Co(e, t, n) {
	return {
		x: e.point.x + e.tangent.x * t + e.normal.x * n,
		z: e.point.z + e.tangent.z * t + e.normal.z * n
	};
}
function wo(e, t) {
	return (e.headingAxis === "x" ? ia(t.tangent) : aa(t.tangent)) + e.turn;
}
function To(e, t) {
	let n = [];
	for (let r of e.parts) {
		let e = r.packId ?? t?.get(r.assetId);
		if (!e) {
			if (r.optional) continue;
			return null;
		}
		n.push({
			...r,
			packId: e
		});
	}
	let r = e.parts.filter((e) => !e.optional);
	return r.length === 0 || n.length < r.length ? null : n;
}
var Eo = ao.academyWall.height, Do = (_o("wall", Eo).z - _o("wall", Eo).x) * .5, Oo = _o("camp", ao.camp.height), ko = _o("tent", ao.tent.height), Ao = Oo.z * .5 + ko.z * .5 + mo, jo = {
	id: "summit-academy-building",
	kind: "building",
	segment: "summit",
	maxGroundSlope: so,
	maxElevationSpan: oo,
	maxShore: .86,
	minRoutePadding: .55,
	nodePadding: .7,
	parts: [
		{
			assetId: "wall-doorway-square",
			kind: "landmark",
			along: 0,
			away: -Do,
			turn: 0,
			height: Eo,
			importance: .96
		},
		{
			assetId: "roof-gable",
			kind: "landmark",
			along: 0,
			away: 0,
			turn: 0,
			lift: ao.academyRoofGable.lift,
			height: ao.academyRoofGable.height,
			importance: .98
		},
		{
			assetId: "wall",
			kind: "prop",
			along: 0,
			away: Do,
			turn: 0,
			height: Eo,
			importance: .68
		},
		{
			assetId: "wall",
			kind: "prop",
			along: Do,
			away: 0,
			turn: Math.PI / 2,
			height: Eo,
			importance: .68
		},
		{
			assetId: "wall",
			kind: "prop",
			along: -Do,
			away: 0,
			turn: Math.PI / 2,
			height: Eo,
			importance: .7
		}
	]
}, Mo = {
	id: "roadside-camp",
	kind: "camp",
	segment: "arrival",
	outpostId: "trail-camp",
	outpostKind: "camp",
	maxGroundSlope: lo,
	maxElevationSpan: co,
	maxShore: .9,
	minRoutePadding: .4,
	nodePadding: .58,
	parts: [{
		assetId: "camp",
		packId: io,
		kind: "landmark",
		along: 0,
		away: 0,
		turn: 0,
		height: ao.camp.height,
		importance: .97,
		state: ao.camp.state
	}, {
		assetId: "tent",
		packId: io,
		kind: "landmark",
		along: -Ao,
		away: .2,
		turn: 0,
		height: ao.tent.height,
		importance: .88,
		facing: "origin"
	}]
}, No = {
	id: "route-bridge",
	kind: "bridge",
	segment: "journey",
	outpostId: "route-bridge",
	outpostKind: "bridge",
	maxGroundSlope: .55,
	maxElevationSpan: 1.05,
	maxShore: .9,
	minRoutePadding: .45,
	nodePadding: .7,
	parts: [{
		assetId: "bridge",
		packId: io,
		kind: "landmark",
		along: 0,
		away: 0,
		turn: 0,
		height: ao.bridge.height,
		importance: .96,
		headingAxis: "x"
	}]
}, Po = {
	halfLength: to.bridge.x / to.bridge.y / 2,
	supportAlong: [
		1.18,
		1.25,
		1.32
	],
	supportAcross: [
		.53,
		.615,
		.7
	],
	deckHalfWidth: .52,
	centerDeckTop: .569,
	lowerDeck: [
		[0, .507],
		[.1815, .482],
		[.363, .456],
		[.5446, .426],
		[.7261, .376],
		[.9076, .301],
		[1.0891, .229],
		[1.2707, .155],
		[1.4522, .077],
		[1.545, .04]
	]
};
function Fo(e) {
	let t = Math.abs(e), n = Po.lowerDeck;
	for (let e = 1; e < n.length; e += 1) {
		let r = n[e - 1], i = n[e];
		if (t <= i[0]) {
			let e = (t - r[0]) / (i[0] - r[0]);
			return r[1] + (i[1] - r[1]) * e;
		}
	}
	return n[n.length - 1][1];
}
function Io(e, t, n, r) {
	let i = Math.hypot(n.x, n.z);
	if (![
		t.x,
		t.z,
		i,
		r
	].every(Number.isFinite) || i < 1e-6 || r <= 0) return {
		ok: !1,
		reason: "invalid-span"
	};
	let a = {
		x: n.x / i,
		z: n.z / i
	}, o = r / (Po.halfLength * 2), s = (e, n) => ({
		x: t.x + (a.x * e - a.z * n) * o,
		z: t.z + (a.z * e + a.x * n) * o
	}), c = (t) => {
		let n = G(e.field, t.x, t.z);
		if (!n.inside || n.shore > .9 || !W(e.blueprint, t.x, t.z).inside) return null;
		let r = e.heightAt(t.x, t.z);
		return Number.isFinite(r) ? r : null;
	}, l = c(t);
	if (l === null) return {
		ok: !1,
		reason: "ground"
	};
	let u = [];
	for (let e of [-1, 1]) for (let t of Po.supportAlong) for (let n of Po.supportAcross) for (let r of [-1, 1]) {
		let i = c(s(e * t, r * n));
		if (i === null) return {
			ok: !1,
			reason: "banks-outside"
		};
		u.push(i);
	}
	let d = Math.max(...u) - Math.min(...u), f = So(u);
	if (d > uo || u.some((e) => Math.abs(e - f) > .08)) return {
		ok: !1,
		reason: "bank-height-mismatch"
	};
	let p = f - l;
	if (p < fo) return {
		ok: !1,
		reason: "no-span"
	};
	let m = Infinity;
	for (let e = 0; e <= 32; e += 1) {
		let t = e / 16 - 1, n = t * Po.halfLength, r = f + Fo(n) * o;
		for (let e of [
			-1,
			-.5,
			0,
			.5,
			1
		]) {
			let i = c(s(n, e * Po.deckHalfWidth));
			if (i === null) return {
				ok: !1,
				reason: "banks-outside"
			};
			let a = r - i;
			if (m = Math.min(m, a), a < (Math.abs(t) <= .6 ? po : .01)) return {
				ok: !1,
				reason: "deck-buried"
			};
		}
	}
	return {
		ok: !0,
		baseY: f,
		deckY: f + o * Po.centerDeckTop,
		supportSpan: d,
		minClearance: m,
		depression: p
	};
}
function Lo(e, t) {
	if (t.length === 0) return null;
	let n = t.map((t) => e(t.x, t.z));
	if (n.some((e) => !Number.isFinite(e))) return null;
	let r = Math.min(...n), i = Math.max(...n), a = 0;
	for (let e = 0; e < t.length; e += 1) for (let n = e + 1; n < t.length; n += 1) a = Math.max(a, Math.hypot(t[e].x - t[n].x, t[e].z - t[n].z));
	return {
		minY: r,
		maxY: i,
		span: i - r,
		slope: (i - r) / Math.max(a, .001),
		baseY: So(n)
	};
}
function Ro(e, t, n) {
	if (e.facing === "origin") {
		let n = Co(t, e.along, e.away);
		return aa({
			x: t.point.x - n.x,
			z: t.point.z - n.z
		});
	}
	return e.headingAxis === "x" && n ? ia(n) + e.turn : wo(e, t);
}
function zo(e, t, n, r) {
	let i = To(e, t.packByAsset);
	if (!i) return {
		ok: !1,
		reason: "missing-asset"
	};
	let a = Qi(t.blueprint) + e.minRoutePadding, o = [];
	for (let e of i) {
		let t = Co(n, e.along, e.away), i = Ro(e, n, r), a = vo(e.assetId, e.height, t.x, t.z, i);
		o.push({
			part: e,
			point: t,
			turn: i,
			footprint: a,
			samples: bo(a)
		});
	}
	if (e.kind === "camp") {
		let e = o.find((e) => e.part.assetId === "camp"), n = o.find((e) => e.part.assetId === "tent");
		if (!e || !n) return {
			ok: !1,
			reason: "missing-asset"
		};
		if (Math.hypot(e.point.x - n.point.x, e.point.z - n.point.z) < xo(e.footprint) * .72 + xo(n.footprint) * .55 + mo * .5) return {
			ok: !1,
			reason: "fire-overlap"
		};
		let r = {
			x: e.point.x - n.point.x,
			z: e.point.z - n.point.z
		}, i = ra(n.turn), a = Math.hypot(r.x, r.z) || 1;
		if ((i.x * r.x + i.z * r.z) / a < .82) return {
			ok: !1,
			reason: "tent-not-facing-fire"
		};
		if (Y(t.blueprint, e.point) > ho) return {
			ok: !1,
			reason: "no-path-access"
		};
	}
	let s = null;
	if (e.kind === "bridge") {
		let e = _o("bridge", ao.bridge.height).x, i = r ?? n.tangent;
		if (s = Io(t, n.point, i, e), !s.ok) return {
			ok: !1,
			reason: s.reason ?? "no-span"
		};
	}
	let c = o.flatMap((e) => (e.part.lift ?? 0) > .4 ? [] : [...e.samples]), l = c.length > 0 ? c : o.flatMap((e) => e.samples);
	for (let n of o.flatMap((e) => e.samples)) {
		let r = G(t.field, n.x, n.z), i = W(t.blueprint, n.x, n.z);
		if (!r.inside || !i.inside) return {
			ok: !1,
			reason: "outside"
		};
		if (r.shore > e.maxShore) return {
			ok: !1,
			reason: "shore"
		};
		if (Y(t.blueprint, n) < a) return {
			ok: !1,
			reason: "route"
		};
		if (Math.hypot(n.x - t.blueprint.hero.x, n.z - t.blueprint.hero.z) < t.blueprint.hero.radius + 1.4) return {
			ok: !1,
			reason: "hero"
		};
		for (let r of t.blueprint.nodes) if (Math.hypot(n.x - r.x, n.z - r.z) < t.blueprint.route.nodeRadius + e.nodePadding) return {
			ok: !1,
			reason: "lesson"
		};
		for (let e of t.occupied ?? []) if (Math.hypot(n.x - e.x, n.z - e.z) < e.radius + .28) return {
			ok: !1,
			reason: "occupied"
		};
	}
	let u = s?.ok && s.baseY !== void 0 ? {
		baseY: s.baseY,
		minY: s.baseY - (s.supportSpan ?? 0) / 2,
		maxY: s.baseY + (s.supportSpan ?? 0) / 2,
		span: s.supportSpan ?? 0,
		slope: 0
	} : Lo(t.heightAt, l);
	if (!u) return {
		ok: !1,
		reason: "ground"
	};
	if (u.slope > e.maxGroundSlope) return {
		ok: !1,
		reason: "slope",
		slope: u.slope,
		span: u.span
	};
	if (u.span > e.maxElevationSpan) return {
		ok: !1,
		reason: "elevation-span",
		slope: u.slope,
		span: u.span
	};
	let d = u.baseY - u.minY, f = u.maxY - u.baseY;
	if (d > e.maxElevationSpan * .55 || f > e.maxElevationSpan * .55) return {
		ok: !1,
		reason: "bury-hover",
		slope: u.slope,
		span: u.span
	};
	let p = u.baseY, m = o.map((t, n) => {
		let r = t.part.lift ?? 0;
		return {
			id: `assembly-${e.id}-${n + 1}`,
			packId: t.part.packId,
			assetId: t.part.assetId,
			kind: t.part.kind,
			segment: e.segment,
			...e.outpostId ? { outpostId: e.outpostId } : {},
			...e.outpostKind ? { outpostKind: e.outpostKind } : {},
			assemblyId: e.id,
			x: t.point.x,
			y: p + r,
			z: t.point.z,
			...t.part.lift === void 0 ? {} : { lift: r },
			turn: t.turn,
			height: t.part.height,
			importance: t.part.importance,
			...t.part.state ? { state: t.part.state } : {}
		};
	});
	return {
		ok: !0,
		baseY: p,
		slope: u.slope,
		span: u.span,
		placements: m
	};
}
var Bo = [
	3.7,
	4.35,
	5.15,
	5.9,
	6.65
], Vo = [
	0,
	-.03,
	.03,
	-.06,
	.06
], Ho = [
	.26,
	.34,
	.42,
	.5,
	.58,
	.66
];
function Uo(e) {
	return R(e)() < .5 ? -1 : 1;
}
function Wo(e, t, n) {
	if (!To(e, t.packByAsset)) return t.onSearchResult?.({
		assemblyId: e.id,
		kind: e.kind,
		status: "omitted",
		attempts: 0,
		rejections: { "missing-asset": 1 },
		members: []
	}), null;
	let r = 0, i = {}, a = Uo(n.seedKey), o = [{
		fractions: e.kind === "bridge" ? n.fractions.map((e) => Math.max(.04, Math.min(.96, e))) : [...new Set(n.fractions.flatMap((e) => Vo.map((t) => Math.round(Math.max(.04, Math.min(.96, e + t)) * 1e3) / 1e3)))],
		sideOffsets: Bo
	}, ...n.fallback ? [n.fallback] : []];
	for (let s of o) for (let o of s.fractions) {
		let c = $i(t.blueprint, o);
		if (c) for (let o of [a, -a]) for (let a of s.sideOffsets) {
			let s = na(c, o, a), l = e.kind === "bridge" ? n.spanAlongTangent === !1 ? [s.normal, c.tangent] : [c.tangent, s.normal] : [c.tangent];
			for (let n of l) {
				r += 1;
				let a = zo(e, t, e.kind === "bridge" ? {
					...s,
					tangent: n
				} : s, e.kind === "bridge" ? n : void 0);
				if (a.ok && a.placements) return t.onSearchResult?.({
					assemblyId: e.id,
					kind: e.kind,
					status: "placed",
					attempts: r,
					rejections: i,
					members: a.placements.map((e) => e.id),
					baseY: a.baseY,
					span: a.span,
					slope: a.slope
				}), a.placements;
				let o = a.reason ?? "no-feasible-site";
				i[o] = (i[o] ?? 0) + 1;
			}
		}
	}
	return t.onSearchResult?.({
		assemblyId: e.id,
		kind: e.kind,
		status: "omitted",
		attempts: r,
		rejections: i,
		members: []
	}), null;
}
function Go(e, t) {
	let n = e.blueprint.zones.find((e) => e.id === "summit"), r = n ? ta(e.blueprint, n) : null;
	return Wo(jo, e, {
		seedKey: t,
		fractions: r !== null && ea(e.blueprint, r) ? [
			r / Math.max(1, e.blueprint.centerline.length - 1),
			.9,
			.84,
			.96
		] : [
			.9,
			.84,
			.96
		],
		...e.blueprint.checkpointGaps?.length ? { fallback: {
			fractions: Array.from({ length: 37 }, (e, t) => (96 - t) / 100),
			sideOffsets: Array.from({ length: 33 }, (e, t) => 2.5 + t / 8)
		} } : {}
	});
}
function Ko(e, t) {
	let n = e.blueprint.zones.find((e) => e.id === "arrival"), r = n ? ta(e.blueprint, n) : null;
	return Wo(Mo, e, {
		seedKey: t,
		fractions: r === null ? [
			.1,
			.16,
			.06
		] : [
			r / Math.max(1, e.blueprint.centerline.length - 1),
			.08,
			.14,
			.2
		]
	});
}
function qo(e, t) {
	return Wo(No, e, {
		seedKey: t,
		fractions: Ho,
		spanAlongTangent: !0
	});
}
var Jo = [
	{
		role: "rockLarge",
		count: 12,
		minSpacing: 1.5,
		radial: [.68, .9],
		height: [.65, .95],
		importance: [.72, .88],
		maxSlope: 1.9,
		clustered: !0,
		prefersSlope: .6,
		clusterRadius: 2.2
	},
	{
		role: "rockMedium",
		count: 28,
		minSpacing: .85,
		radial: [.66, .92],
		height: [.4, .62],
		importance: [.5, .72],
		maxSlope: 1.85,
		clustered: !0,
		prefersSlope: .6,
		clusterRadius: 2.4
	},
	{
		role: "rockSmall",
		count: 26,
		minSpacing: .5,
		radial: [.64, .92],
		height: [.22, .36],
		importance: [.35, .55],
		maxSlope: 1.8,
		clustered: !0,
		prefersSlope: .5,
		clusterRadius: 2.85
	}
], Yo = .88, Xo = 4;
function Zo(e, t, n) {
	let r = [], i = [
		.25,
		.85,
		1.45,
		1.95,
		2.55,
		3.15,
		3.85,
		4.55,
		5.25,
		5.95
	], a = e.bounds.maxHalf * .3, o = (n, i, a) => {
		let o = G(t, n, i), s = W(e, n, i);
		return !o.inside || !s.inside || o.shore > Yo ? !1 : r.every((e) => Math.hypot(n - e.x, i - e.z) >= a) ? (r.push({
			x: n,
			z: i
		}), !0) : !1;
	};
	for (let s of i) {
		if (r.length >= 5) break;
		let i = .78 + n() * .1, c = Math.cos(s) * e.bounds.halfX * i, l = Math.sin(s) * e.bounds.halfZ * i, u = G(t, c, l);
		u.rock <= .28 && u.shore < .7 || o(c, l, a);
	}
	let s = 0;
	for (; r.length < Xo && s < 16;) {
		let t = s / 16 * Math.PI * 2 + n() * .12, r = .76 + s % 4 * .035;
		o(Math.cos(t) * e.bounds.halfX * r, Math.sin(t) * e.bounds.halfZ * r, Math.max(5, a * .72)), s += 1;
	}
	return r;
}
function Qo(e) {
	return e.map((e) => {
		let t = _o(e.assetId, e.height);
		return {
			x: e.x,
			z: e.z,
			radius: Math.max(t.x, t.z) * .5 + .12
		};
	});
}
//#endregion
//#region src/island/island-dressing.ts
var $o = "elemental-serenity", es = {
	short: {
		outposts: 2,
		treesPerGrove: 2,
		quota: .4
	},
	medium: {
		outposts: 3,
		treesPerGrove: 8,
		quota: .72
	},
	long: {
		outposts: 4,
		treesPerGrove: 8,
		quota: 1
	}
};
function ts(e) {
	return e <= 8 ? "short" : e <= 24 ? "medium" : "long";
}
var ns = [
	{
		assetRole: "tree",
		kind: "tree",
		count: 56,
		minSpacing: 1.35,
		radial: [.68, .97],
		height: [2.35, 5.15],
		importance: [.62, .92],
		maxSlope: .88,
		clustered: !0,
		clusterRadius: 4.6,
		vegetationBand: "grove",
		prefersSlope: -.7
	},
	{
		assetRole: "bush",
		kind: "bush",
		count: 68,
		minSpacing: .58,
		radial: [.52, .92],
		height: [.95, 1.45],
		importance: [.3, .58],
		maxSlope: 1.05,
		clustered: !0,
		clusterRadius: 4.8,
		vegetationBand: "grove",
		prefersSlope: -.25
	},
	{
		assetRole: "bush",
		kind: "bush",
		count: 28,
		minSpacing: .58,
		radial: [.52, .92],
		height: [.35, .5],
		importance: [.42, .62],
		maxSlope: 1.05,
		clustered: !0,
		clusterRadius: 1.65,
		vegetationBand: "verge",
		prefersSlope: -.25
	},
	...Jo.map((e) => ({
		assetRole: "rock",
		kind: "rock",
		count: e.count,
		minSpacing: e.minSpacing,
		radial: e.radial,
		height: e.height,
		importance: e.importance,
		maxSlope: e.maxSlope,
		clustered: e.clustered,
		prefersSlope: e.prefersSlope,
		clusterRadius: e.clusterRadius
	}))
], rs = { "fountain-round": {
	segment: "journey",
	kind: "landmark",
	height: .56,
	importance: .98,
	slots: [{
		along: 0,
		away: .75,
		turn: 0
	}]
} };
function is(e, t) {
	let n = e.accentRoles.flatMap((e) => e.assetIds.map((t) => ({
		packId: e.packId,
		assetId: t
	}))).filter(({ packId: e, assetId: t }) => {
		let n = Tt(e, t);
		return n && !n.usedFallback && !/^(wall|roof|floor|platform|gate|room)(?:[-_]|$)/u.test(n.assetId);
	});
	if (n.length === 0) return null;
	for (let e of t) {
		let t = n.find(({ assetId: t }) => t.toLowerCase().includes(e));
		if (t) return t;
	}
	return null;
}
function as(e, t, n, r, i, a, o = {}) {
	return {
		packId: $o,
		assetId: e,
		kind: t,
		along: n,
		away: r,
		height: i,
		importance: a,
		...o
	};
}
function os(e, t, n, r, i, a, o) {
	let s = is(e, t);
	return s ? {
		...s,
		kind: n,
		along: r,
		away: i,
		height: a,
		importance: o
	} : null;
}
function ss(e, t, n, r, i, a = 0) {
	return {
		packId: "nature-kit",
		assetId: e === "landmark" ? "rock_largeA" : "rock_smallA",
		kind: e,
		along: t,
		away: n,
		height: r,
		importance: i,
		turnOffset: a
	};
}
var cs = [
	{
		id: "water-stone-ring",
		kind: "stone-ring",
		segment: "journey",
		fraction: .52,
		parts: () => [
			ss("landmark", 0, 0, .7, .91),
			ss("prop", -1.15, .36, .38, .66, .7),
			as("bushEmitter", "prop", 1.25, .48, .52, .63, { turnOffset: -.4 }),
			as("treeTrunks", "prop", .35, -1.2, .88, .71, { turnOffset: .24 })
		]
	},
	{
		id: "route-market",
		kind: "market",
		segment: "summit",
		fraction: .74,
		parts: (e) => {
			let t = [], n = os(e, [
				"stall",
				"market",
				"cart",
				"dock",
				"cabin",
				"platform",
				"floor",
				"room",
				"gate",
				"wall",
				"tower"
			], "landmark", 0, 0, 1.22, .92), r = os(e, [
				"lantern",
				"light",
				"torch",
				"flag",
				"marker",
				"buoy",
				"crystal",
				"fountain",
				"roof",
				"snow"
			], "prop", 1.65, .42, .84, .74);
			return n && t.push(n), r && t.push(r), t.push(ss("prop", -1.3, -.48, .34, .67)), t;
		}
	},
	{
		id: "lantern-plaza",
		kind: "lantern-plaza",
		segment: "journey",
		fraction: .34,
		parts: (e) => {
			let t = [], n = os(e, [
				"lantern",
				"light",
				"torch",
				"flag",
				"marker",
				"buoy",
				"crystal",
				"fountain"
			], "prop", 0, 0, .92, .86);
			return n ? (t.push(n), t.push(as("treeTrunks", "prop", -1.35, .52, .92, .7, { turnOffset: .2 }), ss("prop", 1.25, .38, .32, .64), as("bushEmitter", "prop", .35, -1.2, .48, .52)), t) : [];
		}
	},
	{
		id: "summit-grove",
		kind: "grove",
		segment: "summit",
		fraction: .9,
		parts: () => [
			as("treeTrunks", "landmark", 0, 0, 1.18, .9, { turnOffset: -.12 }),
			as("bushEmitter", "prop", -1.45, .48, .5, .55, { turnOffset: -.42 }),
			as("bushEmitter", "prop", 1.05, -.42, .36, .42, { turnOffset: -.3 }),
			ss("prop", .8, .68, .32, .62)
		]
	}
], ls = {
	id: "bridge-rest-clearing",
	kind: "stone-ring",
	segment: "journey",
	fraction: .5,
	parts: () => [
		ss("landmark", 0, 0, .7, .9),
		ss("prop", -.95, .42, .36, .64, .55),
		as("bushEmitter", "prop", 1.05, .38, .4, .55, { turnOffset: .28 })
	]
};
function us(e, t) {
	return e === "bridge" ? t.filter((e) => e.outpostId === "bridge-rest-clearing").length >= 2 ? "stone-rest-clearing" : "open-meadow" : e === "building" && t.filter((e) => e.outpostId === "summit-grove").length >= 2 ? "natural-summit" : "open-meadow";
}
function ds(e) {
	return Qi(e);
}
function fs(e, t, n, r, i, a, o, s = 0) {
	let c = Math.min(1, Math.max(0, a / (Math.PI / 2)));
	return !n.inside || n.shore > .975 || n.rock > c || Y(e, t) < ds(e) + s || Math.hypot(t.x - e.hero.x, t.z - e.hero.z) < e.hero.radius + 1.4 || e.nodes.some((e) => Math.hypot(t.x - e.x, t.z - e.z) < o) ? !1 : r.every((e) => {
		let n = Math.hypot(t.x - e.x, t.z - e.z);
		return e.kind !== "landmark" && e.kind !== "prop" ? n >= i : n >= X(e) + Math.max(.25, s) + .2;
	});
}
function ps(e, t, n) {
	let r = t() * Math.PI * 2, i = n[0] + (n[1] - n[0]) * Math.sqrt(t());
	return {
		x: Math.cos(r) * e.bounds.halfX * i,
		z: Math.sin(r) * e.bounds.halfZ * i
	};
}
function ms(e, t, n, r, i, a, o, s) {
	let c = $i(e, n);
	if (!c) return null;
	let l = s === "verge", u = l ? [r] : [r, -r], d = l ? [
		ds(e) + 1.1,
		ds(e) + 1.6,
		ds(e) + 2.1
	] : [
		7.2,
		8.4,
		6.4,
		5.2
	], f = null, p = -Infinity;
	for (let r of u) for (let s of d) {
		let u = {
			x: c.point.x + c.baseNormal.x * s * r,
			z: c.point.z + c.baseNormal.z * s * r
		}, d = G(t, u.x, u.z);
		if (!d.inside || d.shore > .84 || a.some((e) => Math.hypot(u.x - e.x, u.z - e.z) < o) || i.some((e) => {
			let t = _o(e.assetId, e.height);
			return Math.hypot(u.x - e.x, u.z - e.z) < Math.hypot(t.x, t.z) * .5 + (l ? .8 : 2.8);
		}) || Y(e, u) < ds(e) + (l ? .65 : 1.4) || Math.hypot(u.x - e.hero.x, u.z - e.hero.z) < e.hero.radius + (l ? 1.8 : 3.6)) continue;
		let m = d.grass - d.rock * .8;
		m > p && (f = {
			...u,
			routeFraction: n,
			side: r,
			tangent: c.tangent,
			normal: {
				x: c.baseNormal.x * r,
				z: c.baseNormal.z * r
			}
		}, p = m);
	}
	return f;
}
function hs(e, t, n = [], r = br(e)) {
	let i = e.lessonCount <= 8, a = t === "verge" ? i ? 4 : e.lessonCount <= 24 ? 7 : 10 : i ? 3 : e.lessonCount <= 24 ? 7 : 12, o = R(`${e.seed}/${e.layoutRevision}/dressing-side`)() < .5 ? -1 : 1, s = [], c = t === "verge" ? 2.6 : Math.min(7.8, e.bounds.maxHalf * .72);
	for (let i = 0; i < a; i += 1) {
		let l = .04 + i / Math.max(1, a - 1) * .92, u = i % 2 == 0 ? o : -o;
		for (let i of t === "verge" ? [u, -u] : [u]) for (let a of [
			0,
			-.025,
			.025,
			-.05,
			.05
		]) {
			let o = ms(e, r, Math.max(.01, Math.min(.99, l + a)), i, n, s, c, t);
			if (o) {
				s.push(o);
				break;
			}
		}
	}
	return t === "grove" && s.push(...qa(e, r, n.map((e) => ({
		...e,
		radius: X(e)
	})), s)), s;
}
function gs(e, t, n) {
	let r = e.zones.find((e) => e.id === n);
	if (!r || e.centerline.length === 0) return null;
	let i = 0, a = Infinity;
	e.centerline.forEach((e, t) => {
		let n = Math.hypot(e.x - r.x, e.z - r.z);
		n < a && (a = n, i = t);
	});
	let o = R(`${e.seed}/${e.layoutRevision}/academy/${n}`)() < .5 ? -1 : 1, s = e.centerline[i], c = e.centerline[Math.max(0, i - 2)] ?? s, l = e.centerline[Math.min(e.centerline.length - 1, i + 2)] ?? s, u = l.x - c.x, d = l.z - c.z, f = Math.hypot(u, d) || 1, p = {
		x: u / f,
		z: d / f
	}, m = {
		x: -p.z,
		z: p.x
	}, h = Object.values(rs).flatMap((e) => e.slots.filter((t) => (t.segment ?? e.segment) === n)), g = null;
	for (let n of [o, -o]) for (let r of [
		5.2,
		4.35,
		6.1
	]) {
		let i = {
			x: s.x + m.x * r * n,
			z: s.z + m.z * r * n
		}, a = G(t, i.x, i.z);
		if (!a.inside || a.shore > .84 || Y(e, i) < ds(e) + 1.4 || Math.hypot(i.x - e.hero.x, i.z - e.hero.z) < e.hero.radius + 3.6) continue;
		let o = n < 0 ? {
			x: -m.x,
			z: -m.z
		} : m, c = h.filter((n) => {
			let r = {
				x: i.x + p.x * n.along + o.x * n.away,
				z: i.z + p.z * n.along + o.z * n.away
			}, a = G(t, r.x, r.z);
			return a.inside && a.shore <= .88 && Y(e, r) >= ds(e) && Math.hypot(r.x - e.hero.x, r.z - e.hero.z) >= e.hero.radius + 1.4;
		}).length / Math.max(1, h.length);
		if ((g === null || c > g.score) && (g = {
			point: i,
			normal: o,
			score: c
		}), c === 1) return {
			point: i,
			tangent: p,
			normal: o
		};
	}
	return g ? {
		point: g.point,
		tangent: p,
		normal: g.normal
	} : null;
}
function _s(e, t) {
	if (e.centerline.length === 0) return null;
	let n = Math.min(e.centerline.length - 1, Math.max(0, Math.round(t * (e.centerline.length - 1)))), r = e.centerline[n], i = e.centerline[Math.max(0, n - 2)] ?? r, a = e.centerline[Math.min(e.centerline.length - 1, n + 2)] ?? r, o = a.x - i.x, s = a.z - i.z, c = Math.hypot(o, s) || 1, l = {
		x: o / c,
		z: s / c
	};
	return {
		routePoint: r,
		tangent: l,
		baseNormal: {
			x: -l.z,
			z: l.x
		}
	};
}
function vs(e) {
	let t = es[ts(e.lessonCount)].outposts;
	return cs.slice(0, t);
}
function X(e) {
	let t = e.assetId ?? (e.kind === "rock" ? "rock_largeA" : void 0);
	if (t && go(t)) {
		let n = _o(t, e.height);
		return Math.hypot(n.x, n.z) * .5;
	}
	return t === "treeTrunks" || e.kind === "tree" ? Nt("tree", e.height) : t === "bushEmitter" || e.kind === "bush" ? Nt("bush", e.height) : Infinity;
}
function ys(e) {
	let t = Tt(e.packId, e.assetId);
	if (!t || t.usedFallback) return null;
	if (go(t.assetId)) return vo(t.assetId, e.height, e.x, e.z, e.turn);
	let n = X(e);
	return Number.isFinite(n) ? {
		x: e.x,
		z: e.z,
		halfX: n,
		halfZ: n,
		turn: 0
	} : null;
}
function bs(e, t) {
	let n = ys(t);
	if (!n) return null;
	let r = bi(e, bo(n).slice(1, 5));
	if (!r) return null;
	let i = t.assetId === "treeTrunks" || t.assetId === "bushEmitter", a = Math.min(.25, t.height * (i ? .4 : .5));
	return r.maxY - r.minY > a || r.maxSlope > (i ? .65 : .32) ? null : r.minY + (t.lift ?? 0);
}
function xs(e) {
	let t = 1;
	for (let n = 0; n < e.length; n++) for (let r = 0; r < n; r++) {
		let i = e[n], a = e[r], o = Math.hypot(i.along - a.along, i.away - a.away);
		if (o < 1e-6) return [];
		t = Math.max(t, (X(i) + X(a) + .12) / o);
	}
	return Number.isFinite(t) ? e.map((e) => ({
		...e,
		along: e.along * t,
		away: e.away * t
	})) : [];
}
function Ss(e, t, n, r) {
	let i = G(t, n.x, n.z);
	if (!i.inside || i.shore > .88) return !1;
	let a = X(n), o = ys(n);
	if (!o) return !1;
	for (let e of bo(o)) {
		let n = G(t, e.x, e.z);
		if (!n.inside || n.shore > .975) return !1;
	}
	return Y(e, n) < ds(e) + a + .42 || Math.hypot(n.x - e.hero.x, n.z - e.hero.z) < e.hero.radius + a + 1.45 || e.nodes.some((t) => Math.hypot(n.x - t.x, n.z - t.z) < e.route.nodeRadius + a + .5) ? !1 : r.every((e) => {
		let t = X(e), r = n.outpostId !== void 0 && e.outpostId === n.outpostId, i = r ? .18 : .4;
		return Math.hypot(n.x - e.x, n.z - e.z) >= Math.max(i, a) + Math.max(i, t) + (r ? .08 : .32);
	}) && bs(e, n) !== null;
}
function Cs(e, t, n, r) {
	let i = {
		x: t.point.x + t.tangent.x * n.along + t.normal.x * n.away,
		z: t.point.z + t.tangent.z * n.along + t.normal.z * n.away
	}, a = n.headingAxis === "x" ? Math.atan2(t.tangent.z, t.tangent.x) : Math.atan2(t.tangent.x, t.tangent.z), o = n.lift ?? 0;
	return {
		id: `outpost-${e.id}-${r + 1}`,
		packId: n.packId,
		assetId: n.assetId,
		kind: n.kind,
		segment: e.segment,
		outpostId: e.id,
		outpostKind: e.kind,
		x: i.x,
		y: 0,
		z: i.z,
		...n.lift === void 0 ? {} : { lift: o },
		turn: a + (n.turnOffset ?? 0),
		height: n.height,
		importance: n.importance,
		...n.state ? { state: n.state } : {}
	};
}
function ws(e, t, n, r, i) {
	let a = [], o = `${e.seed}/${e.layoutRevision}/assembly`, s = Ko(js(e, t, [...n, ...a], r, i), `${o}/camp`);
	s && a.push(...Ms(s));
	let c = qo(js(e, t, [...n, ...a], r, i), `${o}/bridge`);
	return c ? (a.push(...Ms(c)), a) : (a.push(...Es(e, t, [...n, ...a])), a);
}
function Ts(e, t, n = [], r = br(e)) {
	let i = [], a = [...n];
	for (let n of vs(e)) {
		let o = xs(n.parts(t));
		if (o.length < 2) continue;
		let s = R(`${e.seed}/${e.layoutRevision}/outpost/${n.id}/side`)() < .5 ? -1 : 1, c = null;
		for (let t of [
			n.fraction,
			n.fraction - .035,
			n.fraction + .035,
			n.fraction - .07,
			n.fraction + .07
		]) {
			if (c) break;
			let i = _s(e, Math.max(.02, Math.min(.98, t)));
			if (i) for (let t of [s, -s]) {
				if (c) break;
				for (let s of [
					3.2,
					3.9,
					4.7,
					5.5,
					6.4,
					7.1
				]) {
					let l = {
						x: i.routePoint.x + i.baseNormal.x * s * t,
						z: i.routePoint.z + i.baseNormal.z * s * t
					}, u = t < 0 ? {
						x: -i.baseNormal.x,
						z: -i.baseNormal.z
					} : i.baseNormal, d = {
						point: l,
						tangent: i.tangent,
						normal: u
					}, f = o.map((e, t) => Cs(n, d, e, t));
					if (f.every((t, n) => Ss(e, r, t, [...a, ...f.slice(0, n)]))) {
						c = f;
						break;
					}
				}
			}
		}
		if (!c) continue;
		let l = c.map((t) => ({
			...t,
			y: bs(e, t)
		}));
		i.push(...l), a.push(...l);
	}
	return i;
}
function Es(e, t, n, r = !1) {
	let i = xs(r ? [
		ss("landmark", 0, 0, .42, .9),
		ss("prop", -.7, .24, .25, .64, .55),
		as("bushEmitter", "prop", .72, .24, .3, .55)
	] : ls.parts()), a = R(`${e.seed}/${e.layoutRevision}/bridge-rest/side`)() < .5 ? -1 : 1, o = r ? [
		...Ho,
		.18,
		.22,
		.3,
		.38,
		.46,
		.54,
		.62,
		.7,
		.78,
		.04,
		.1,
		.86,
		.92,
		.98
	] : Ho, s = r ? [
		3.2,
		3.9,
		4.7,
		5.5,
		6.4,
		7.3,
		8.2,
		9.1
	] : [
		3.2,
		3.9,
		4.7,
		5.5,
		6.4
	];
	for (let r of o) {
		let o = _s(e, r);
		if (o) for (let r of [a, -a]) for (let a of s) {
			let s = {
				point: {
					x: o.routePoint.x + o.baseNormal.x * a * r,
					z: o.routePoint.z + o.baseNormal.z * a * r
				},
				tangent: o.tangent,
				normal: r < 0 ? {
					x: -o.baseNormal.x,
					z: -o.baseNormal.z
				} : o.baseNormal
			}, c = i.map((e, t) => Cs(ls, s, e, t));
			if (c.every((r, i) => Ss(e, t, r, [...n, ...c.slice(0, i)]))) return c.map((t) => ({
				...t,
				y: bs(e, t),
				companionOf: "route-bridge"
			}));
		}
	}
	return [];
}
function Ds(e, t, n, r, i) {
	if (!t.clustered || n.length === 0 || t.kind === "rock" && r() < .12) return ps(e, r, t.radial);
	let a = n[t.kind === "rock" ? Math.floor(r() * n.length) : i % n.length];
	if (t.vegetationBand === "verge") {
		let e = a, n = (r() - .5) * (t.clusterRadius ?? 1.65) * 2, i = (r() - .5) * .72;
		return {
			x: a.x + e.tangent.x * n + e.normal.x * i,
			z: a.z + e.tangent.z * n + e.normal.z * i
		};
	}
	let o = r() * Math.PI * 2, s = t.kind === "tree" && Math.floor(i / n.length) < 2 ? .45 + r() * 1.35 : .45 + Math.sqrt(r()) * (t.clusterRadius ?? 2.75);
	return {
		x: a.x + Math.cos(o) * s,
		z: a.z + Math.sin(o) * s
	};
}
function Os(e, t, n) {
	let r = t.prefersSlope ?? 0;
	if (r === 0) return !0;
	let i = e.rock, a = r > 0 ? i : 1 - i;
	return n() < .22 + a * Math.abs(r) * .78;
}
function ks(e, t) {
	let n = t.kind === "rock" ? e.rock : e.grass;
	return t.kind === "rock" ? .34 + n * .66 : .12 + n * n * .88;
}
function As(e, t, n = [], r = br(e), i = [], a = null) {
	let o = [], s = [...n], c = [...n], l = hs(e, "grove", n, r), u = l.map((t) => {
		let a = i.filter((e) => e.feature !== "ruin").map((e) => ({
			rock: e,
			distance: Math.hypot(t.x - e.x, t.z - e.z)
		})).sort((e, t) => e.distance - e.rock.radius - (t.distance - t.rock.radius))[0];
		if (!a || a.distance - a.rock.radius > 6 || a.distance < .01) return t;
		let { rock: o, distance: s } = a, c = o.radius + 3.2, l = {
			x: o.x + (t.x - o.x) / s * c,
			z: o.z + (t.z - o.z) / s * c
		}, u = G(r, l.x, l.z);
		return !u.inside || u.shore > .8 || Y(e, l) < ds(e) + 3 || n.some((e) => Math.hypot(e.x - l.x, e.z - l.z) < X(e) + 3.6) ? t : {
			...t,
			...l
		};
	}), d = hs(e, "verge", n, r), f = Zo(e, r, R(`${e.seed}/${e.layoutRevision}/dressing/rock-centres`)), p = (t, n, l, u, d, f, p, m) => {
		let h = o.length;
		for (let g = 0; g < p && !(o.length - h >= f); g += 1) {
			let p = Ds(e, t, u, l, g);
			if (t.kind === "tree" || t.kind === "bush") {
				let n = (e) => {
					let t = G(r, e.x, e.z);
					return t.inside ? t.grass - t.rock * .8 : -Infinity;
				}, i = n(p);
				for (let r = 0; r < 2; r += 1) {
					let r = Ds(e, t, u, l, g), a = n(r);
					a > i && (p = r, i = a);
				}
			}
			let h = t.kind === "bush" ? c : s, _ = G(r, p.x, p.z);
			if (l() > ks(_, t)) continue;
			let v = d.reduce((e, t, n) => e < 0 || Math.hypot(p.x - t.x, p.z - t.z) < Math.hypot(p.x - d[e].x, p.z - d[e].z) ? n : e, -1), y = t.kind === "tree" ? o.filter((e) => e.kind === "tree" && e.clusterId === `${m}-${v + 1}`) : [], b = y.length, x = L(`${e.seed}/grove-growth/${g}/${v}`), S = b === 0 ? g > f * 24 ? .64 : g > f * 10 ? .8 : 1 : 1, C = t.height[1] * (b ? y[0].height / t.height[1] : S) * (b === 0 ? .94 + x * .06 : b % 3 == 1 ? .46 + x * .18 : .65 + x * .15), w = e.route.nodeRadius + (t.kind === "tree" ? C * .52 : t.kind === "rock" ? .3 : X({
				kind: t.kind,
				height: t.height[1]
			}));
			if (!fs(e, p, _, h, t.minSpacing, t.maxSlope, w, t.kind === "tree" ? C * .52 : t.kind === "bush" ? Nt("bush", t.height[1]) : 0) || !Os(_, t, l)) continue;
			let T = t.kind === "rock" ? null : q(e, "course", p.x, p.z), E = n[Math.floor(l() * n.length)], D = l(), O = d.reduce((e, t, n) => e < 0 || Math.hypot(p.x - t.x, p.z - t.z) < Math.hypot(p.x - d[e].x, p.z - d[e].z) ? n : e, -1);
			if (t.kind !== "rock" && t.vegetationBand !== "verge") {
				let e = d[O];
				if (Math.hypot(p.x - e.x, p.z - e.z) > (t.kind === "tree" ? 5.1 : 5.3)) continue;
			}
			let k = l() * Math.PI * 2, A = t.kind === "tree" ? C : t.height[0] + (t.height[1] - t.height[0]) * D, j = p, M = k, N = T ?? { y: 0 };
			if (t.kind === "rock") {
				let n = Math.hypot(p.x, p.z), i = n > .1 ? {
					x: -p.x / n,
					z: -p.z / n
				} : {
					x: 0,
					z: 0
				}, a = [
					0,
					.8,
					1.6,
					2.4
				], o = [k, k + Math.PI * .5], c = X({
					kind: "rock",
					height: A,
					assetId: E.assetId
				}), l = null;
				offsetLoop: for (let n of a) {
					let a = p.x + i.x * n, u = p.z + i.z * n, d = G(r, a, u);
					if (!d.inside || d.shore > .96 || Y(e, {
						x: a,
						z: u
					}) < ds(e) || s.some((e) => Math.hypot(a - e.x, u - e.z) < Math.max(t.minSpacing, c + X(e) * .4))) continue;
					let f = null;
					for (let t of o) {
						let n = bo(vo(E.assetId, A, a, u, t)), i = !0;
						for (let e of n) {
							let t = G(r, e.x, e.z);
							if (!t.inside || t.shore > .975) {
								i = !1;
								break;
							}
						}
						if (i) {
							for (let t of n) {
								if (e.nodes.some((n) => Math.hypot(t.x - n.x, t.z - n.z) < e.route.nodeRadius)) {
									i = !1;
									break;
								}
								if (Math.hypot(t.x - e.hero.x, t.z - e.hero.z) < e.hero.radius) {
									i = !1;
									break;
								}
							}
							if (i) {
								for (let t of n) if (Y(e, t) < ds(e)) {
									i = !1;
									break;
								}
								if (i) {
									f ||= q(e, "course", a, u);
									for (let t = 1; t < n.length; t += 1) {
										let r = n[t], a = q(e, "course", r.x, r.z);
										if (Math.abs(a.y - f.y) > .25 || f.y + A <= a.y) {
											i = !1;
											break;
										}
									}
									if (i) {
										l = {
											point: {
												x: a,
												z: u
											},
											turn: t,
											surface: f
										};
										break offsetLoop;
									}
								}
							}
						}
					}
				}
				if (!l) continue;
				j = l.point, M = l.turn, N = l.surface;
			}
			let P = 0;
			if (t.kind === "tree") {
				let t = bi(e, ja(j.x, j.z, A * Dt), "course");
				if (!t || t.maxY - t.minY > .25) continue;
				P = Math.min(0, t.minY - .01 - N.y);
				let n = Ha(`${e.seed}/nature-tree-${o.length + 1}`, j.x, j.z) ? "fir" : "broadleaf";
				if (o.some((t) => t.kind === "tree" && !Ka({
					x: t.x,
					y: t.y + (t.foliageRootOffset ?? 0),
					z: t.z,
					height: t.height,
					form: Ha(`${e.seed}/${t.id}`, t.x, t.z) ? "fir" : "broadleaf"
				}, {
					...j,
					y: N.y + P,
					height: A,
					form: n
				}))) continue;
			}
			let F = {
				id: `nature-${t.kind}-${o.length + 1}`,
				packId: E.packId,
				assetId: E.assetId,
				kind: t.kind,
				x: j.x,
				y: N.y,
				z: j.z,
				turn: M,
				height: A,
				...t.kind === "tree" ? { foliageRootOffset: P } : {},
				importance: t.importance[0] + (t.importance[1] - t.importance[0]) * D,
				...O >= 0 ? { clusterId: `${t.kind === "rock" ? "headland" : t.vegetationBand === "verge" ? "verge" : m}-${O + 1}` } : {},
				...t.kind === "tree" || t.kind === "bush" ? { foliageTint: Va(r, u[O] ?? j) } : {}
			};
			a && Fa(a, F, X(F) + .2) || i.some((e) => Math.hypot(F.x - e.x, F.z - e.z) < e.radius + X(F) + .45) || (o.push(F), (t.kind === "bush" ? c : s).push(F));
		}
	}, m = Math.min(1.78, Math.max(.9, .72 + Math.sqrt(e.lessonCount) / 6.8));
	for (let n of ns) {
		let r = n.assetRole === "rock" ? t.base.naturalAssets.rocks : [t.base.naturalAssets[n.assetRole]], i = R(`${e.seed}/${e.layoutRevision}/dressing/${n.kind}/${n.height[0]}`), a = n.kind === "rock" ? f : n.vegetationBand === "verge" ? d : u, o = n.kind !== "rock" && n.vegetationBand !== "verge" ? l : a;
		if (n.kind !== "rock" && a.length === 0) continue;
		let s = es[ts(e.lessonCount)], c = Math.round(n.count * m * s.quota), h = n.kind === "tree" ? Math.min(64, c, Math.max(1, a.length) * s.treesPerGrove) : c;
		p(n, r, i, a, o, h, n.kind === "rock" ? Math.max(h, n.count) * 22 : h * 44, "grove");
	}
	let h = Ya(e, r, [...n, ...o].map((e) => ({
		...e,
		radius: X(e)
	})), l);
	if (h.length > 0) for (let n of ns) {
		if (n.kind === "rock" || n.vegetationBand === "verge") continue;
		let r = [t.base.naturalAssets[n.assetRole]], i = R(`${e.seed}/${e.layoutRevision}/dressing/interior/${n.kind}`), a = Ja(e), o = h.length * (n.kind === "tree" ? Math.max(2, Math.round(9 * a)) : Math.max(3, Math.round(12 * a)));
		p(n, r, i, h, h, o, o * 44, "interior");
	}
	return {
		placements: o,
		interior: h
	};
}
function js(e, t, n, r, i) {
	return {
		blueprint: e,
		field: t,
		heightAt: (t, n) => q(e, "course", t, n).y,
		occupied: Qo(n),
		packByAsset: r,
		...i ? { onSearchResult: (e) => i.push(e) } : {}
	};
}
function Ms(e) {
	return e;
}
function Ns(e, t, n, r, i, a) {
	let o = vo(n, r, i.x, i.z, a), s = ds(e);
	for (let n of bo(o)) {
		let r = G(t, n.x, n.z), i = W(e, n.x, n.z);
		if (!r.inside || !i.inside || r.shore > .9 || Y(e, n) < s || Math.hypot(n.x - e.hero.x, n.z - e.hero.z) < e.hero.radius + 1.4 || e.nodes.some((t) => Math.hypot(n.x - t.x, n.z - t.z) < e.route.nodeRadius + .55)) return !1;
	}
	return !0;
}
function Ps(e, t, n = br(e), r) {
	let i = /* @__PURE__ */ new Map();
	t.accentRoles.forEach((e) => e.assetIds.forEach((t) => i.set(t, e.packId)));
	let a = Go(js(e, n, [], i, r), `${e.seed}/${e.layoutRevision}/assembly/academy`), o = a ? Ms(a) : [], s = /* @__PURE__ */ new Map();
	for (let t of [
		"arrival",
		"journey",
		"summit"
	]) s.set(t, gs(e, n, t));
	for (let [t, r] of Object.entries(rs)) {
		let a = i.get(t);
		a && r.slots.forEach((i, c) => {
			let l = i.segment ?? r.segment, u = s.get(l);
			if (!u) return;
			let d = {
				x: u.point.x + u.tangent.x * i.along + u.normal.x * i.away,
				z: u.point.z + u.tangent.z * i.along + u.normal.z * i.away
			}, f = Math.atan2(u.tangent.x, u.tangent.z) + i.turn;
			if (!Ns(e, n, t, r.height, d, f)) return;
			let p = q(e, "course", d.x, d.z), m = i.lift ?? 0;
			o.push({
				id: `accent-${t}-${c + 1}`,
				packId: a,
				assetId: t,
				kind: r.kind,
				segment: l,
				x: d.x,
				y: p.y + m,
				z: d.z,
				...i.lift === void 0 ? {} : { lift: m },
				turn: f,
				height: r.height,
				importance: r.importance
			});
		});
	}
	return o;
}
function Fs(e, t) {
	let n = t ?? eo(e.themeSelection.recipeId ?? "");
	if (!n) throw Error("Island dressing needs a registered recipe");
	let r = $a(n);
	if (!r.ok) throw Error(`Invalid island recipe: ${r.errors.join("; ")}`);
	if (e.themeSelection.naturalBasePackId !== n.base.packId || e.themeSelection.accentPackIds.join("/") !== n.accentPackIds.join("/")) throw Error("Island blueprint theme selection does not match its dressing recipe");
	return n;
}
function Is(e, t, n, r) {
	let i = r.get("lantern");
	if (!i) return [];
	let a = [];
	for (let r of [
		"arrival",
		"journey",
		"summit"
	]) {
		let o = n.filter((e) => e.segment === r && [
			"camp",
			"fountain-round",
			"wall-doorway-square",
			"stall"
		].includes(e.assetId))[0];
		if (!o) continue;
		let s = _o(o.assetId, o.height), c = Math.max(1.3, Math.hypot(s.x, s.z) * .5 + .45), l = R(`${e.seed}/facility-light/${r}`)() * Math.PI * 2;
		for (let s = 0; s < 16; s += 1) {
			let u = l + s * Math.PI / 8, d = {
				x: o.x + Math.cos(u) * c,
				z: o.z + Math.sin(u) * c
			};
			if (!Ns(e, t, "lantern", 1.2, d, u) || [...n, ...a].some((e) => {
				let t = _o(e.assetId, e.height);
				return Math.hypot(d.x - e.x, d.z - e.z) < Math.hypot(t.x, t.z) * .5 + .18;
			})) continue;
			let f = bo(vo("lantern", 1.2, d.x, d.z, u)).map((t) => q(e, "course", t.x, t.z).y);
			if (!(Math.max(...f) - Math.min(...f) > .08)) {
				a.push({
					id: `facility-light-${r}`,
					packId: i,
					assetId: "lantern",
					kind: "prop",
					segment: r,
					companionOf: o.id,
					x: d.x,
					z: d.z,
					y: Math.min(...f),
					turn: u,
					height: 1.2,
					importance: .64
				});
				break;
			}
		}
	}
	return a;
}
function Ls(e, t, n, r) {
	let i = [], a = n.filter((e) => [
		"camp",
		"wall-doorway-square",
		"stall"
	].includes(e.assetId));
	for (let o of a) {
		let a = o.assetId === "stall" && e.lessonCount > 8 ? ["stall-bench", "cart"] : ["stall-bench"];
		if (e.lessonCount <= 8 && i.length > 0) break;
		for (let s of a) {
			let a = r.get(s);
			if (!a) continue;
			let c = s === "cart" ? .75 : .45, l = X(o) + X({
				assetId: s,
				height: c,
				kind: "prop"
			}) + .65, u = R(`${e.seed}/facility-furniture/${o.id}/${s}`)() * Math.PI * 2, d = !1;
			for (let r of [
				1,
				1.25,
				1.5
			]) {
				for (let f = 0; f < 24; f++) {
					let p = u + f * Math.PI / 12, m = {
						id: `furniture-${o.id}-${s}`,
						packId: a,
						assetId: s,
						kind: "prop",
						segment: o.segment,
						companionOf: o.id,
						x: o.x + Math.cos(p) * l * r,
						z: o.z + Math.sin(p) * l * r,
						y: 0,
						height: c,
						turn: s === "cart" ? o.turn : Math.PI / 2 - p,
						importance: .56
					};
					if (Ss(e, t, m, [...n, ...i])) {
						i.push({
							...m,
							y: bs(e, m)
						}), d = !0;
						break;
					}
				}
				if (d) break;
			}
		}
	}
	return i;
}
function Rs(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		if (!n.outpostId) continue;
		let e = t.get(n.outpostId);
		(!e || n.importance > e.importance || n.importance === e.importance && n.id < e.id) && t.set(n.outpostId, n);
	}
	let n = [...e.filter((e) => e.kind === "landmark" && !e.outpostId), ...t.values()].sort((e, t) => t.importance - e.importance || e.id.localeCompare(t.id)), r = e.filter((e) => e.kind === "tree").sort((e, t) => t.importance - e.importance || e.id.localeCompare(t.id)).slice(0, 1);
	return [...n.slice(0, 8 - r.length), ...r].sort((e, t) => t.importance - e.importance || e.id.localeCompare(t.id));
}
function zs(e, t, n) {
	let r = Fs(e, n), i = br(e), a = /* @__PURE__ */ new Map();
	r.accentRoles.forEach((e) => e.assetIds.forEach((t) => a.set(t, e.packId)));
	let o = [], s = Ps(e, r, i, o), c = ws(e, i, s, a, o), l = Ts(e, r, [...s, ...c], i), u = [
		...s,
		...c,
		...l
	];
	!u.some((e) => e.outpostId && !e.assemblyId) && !c.some((e) => e.assemblyId === "route-bridge") && u.push(...Es(e, i, u, !0));
	let d = [...u, ...Is(e, i, u, a)], f = [...d, ...Ls(e, i, d, a)], p = Ma(e, f.map((e) => ({
		...e,
		radius: X(e)
	}))), m = {
		...p,
		spring: Ia(e, [...f.map((e) => ({
			...e,
			radius: X(e)
		})), ...p.outcrops])
	}, h = As(e, r, f, i, m.outcrops, m.spring), g = [...h.placements, ...f].map((t) => {
		if (t.kind !== "tree" && t.kind !== "bush") return t;
		let n = `${e.seed}/${t.id}`;
		return {
			...t,
			foliageTint: t.foliageTint ?? Va(i, t),
			foliageShapeSeed: n,
			...t.kind === "bush" ? { foliageGroundOffsets: zt({
				position: {
					x: t.x,
					y: t.y,
					z: t.z
				},
				height: t.height,
				turn: t.turn,
				shapeSeed: n
			}, (t, n) => q(e, "course", t, n).y) } : {}
		};
	}), _ = t === "course" ? g : Rs(g);
	return {
		version: 1,
		detail: t,
		seed: e.seed,
		recipeId: r.id,
		placements: _,
		...t === "course" && h.interior.length ? { interiorGroves: h.interior.map(({ x: e, z: t }) => ({
			x: e,
			z: t
		})) } : {},
		landscape: m,
		decisions: o.map((e) => {
			if (e.status !== "omitted") return e;
			let t = us(e.kind, g), n = t === "stone-rest-clearing" ? g.filter((e) => e.outpostId === "bridge-rest-clearing").map((e) => e.id) : t === "natural-summit" ? g.filter((e) => e.outpostId === "summit-grove").map((e) => e.id) : [];
			return {
				...e,
				fallback: t,
				members: n
			};
		})
	};
}
var Bs = /* @__PURE__ */ new WeakMap();
function Vs(e, t, n) {
	let r = Fs(e, n), i = Bs.get(e);
	i || (i = /* @__PURE__ */ new WeakMap(), Bs.set(e, i));
	let a = i.get(r);
	return a || (a = { course: zs(e, "course", r) }, i.set(r, a)), t === "course" ? a.course : (a.world ??= {
		...a.course,
		detail: "world",
		placements: Rs(a.course.placements)
	}, a.world);
}
//#endregion
//#region src/island/miniature-layout.ts
var Hs = /* @__PURE__ */ new Map();
function Us(e) {
	let t = Hs.get(e);
	if (t) return t;
	let n = U(e);
	try {
		let t = n.getAttribute("position");
		n.computeBoundingBox();
		let r = n.boundingBox, i = 0, a = 0;
		for (let e = 0; e < t.count; e++) {
			let n = Math.hypot(t.getX(e), t.getZ(e));
			i = Math.max(i, n), t.getY(e) <= r.min.y + .025 && (a = Math.max(a, n));
		}
		let o = {
			triangles: (n.index?.count ?? t.count) / 3,
			radius: i,
			supportRadius: Math.max(.025, a),
			height: r.max.y - r.min.y
		};
		return Hs.set(e, o), o;
	} finally {
		n.dispose();
	}
}
var Ws = /* @__PURE__ */ new WeakMap(), Gs = (e, t, n) => Array.from({ length: 8 }, (r, i) => {
	let a = i * Math.PI / 4;
	return {
		x: e + Math.cos(a) * n,
		z: t + Math.sin(a) * n
	};
});
function Ks(e) {
	let t = Ws.get(e);
	if (t) return t;
	let n = Ar(e), r = R(`${e.seed}/miniature-composition-v1`), i = e.bounds.maxHalf, a = [], o = null, s = (t, n, r) => {
		let a = Gs(t * i, n * i, r * i);
		if (a.some((t) => !Nn(t, e.outline))) return null;
		let o = bi(e, a, "world");
		return o ? {
			min: o.minY / i,
			max: o.maxY / i
		} : null;
	}, c = (e, t, n, r, i, c) => {
		let l = Us(e), u = l.radius * i, d = l.supportRadius * i;
		if (!s(n, r, u) || t === "tree" && Math.hypot(n, r) < .26 + u || t === "tree" && r > -.08 && Math.abs(n) < .23 + d || t === "landmark" && i * l.height > .35 && Math.hypot(n, r) < .26 + d || o && Math.hypot(n - o.x, r - o.z) < o.radius + d + .025 || a.some((e) => Math.hypot(n - e.x, r - e.z) < (t === "accent" ? d + e.supportRadius + .015 : u + e.radius * .8))) return !1;
		let f = s(n, r, d);
		return !f || f.max - f.min > (t === "tree" ? .035 : .05) ? !1 : (a.push({
			asset: e,
			role: t,
			x: n,
			z: r,
			y: f.min - .004,
			size: i,
			turn: c,
			radius: u,
			supportRadius: d,
			groundRange: [f.min, f.max]
		}), !0);
	};
	if (n.water) for (let e of [
		.28,
		.23,
		.19,
		.15
	]) {
		if (o) break;
		for (let t = 0; t < 64; t++) {
			let r = t * 2.399963229728653, i = .22 + t % 5 * .065, a = Math.cos(r) * i, c = Math.sin(r) * i, l = s(a, c, e * 1.12);
			if (l && l.max - l.min < .045) {
				o = {
					x: a,
					z: c,
					y: l.max + .006,
					radius: e,
					cascade: n.water === "cascade"
				};
				break;
			}
		}
	}
	let l = n.focal === "fence" ? .45 : n.focal === "crystal" ? 1.16 : n.focal === "snowpeak" ? 1.15 : 1.02, u = {
		x: e.hero.x / i,
		z: e.hero.z / i
	}, d = !1, f = n.focal === "fence" ? .45 : n.focal === "snowpeak" ? 1.05 : .86, p = [...new Set([l, f].flatMap((e) => [
		1,
		.86,
		.74,
		.62,
		.55
	].map((t) => e * t)))].sort((e, t) => t - e);
	for (let e of p) {
		if (d) break;
		for (let t = 0; t < 48; t++) {
			let r = t * 2.399963229728653, i = t === 0 ? n.focal === "fence" ? -.34 : u.x * .7 : Math.cos(r) * (.32 + t % 6 * .075), a = t === 0 ? n.focal === "fence" ? .28 : u.z * .7 : Math.sin(r) * (.32 + t % 6 * .075);
			if (c(n.focal, "landmark", i, a, e, .4)) {
				d = !0;
				break;
			}
		}
	}
	let m = e.lessonCount <= 5 || n.id === "garden" ? 2 : n.id === "blossom" || e.lessonCount <= 12 ? 3 : 5, h = r() * Math.PI * 2;
	for (let e = 0; e < m; e++) {
		let t = (e % 3 == 0 ? .57 : .47) + r() * .07;
		for (let i = 0; i < 40; i++) {
			let a = h + e * 1.8 + i * 2.399963229728653, o = .36 + i % 5 * .065;
			if (c(n.tree, "tree", Math.cos(a) * o, Math.sin(a) * o, t, r() * 6.28)) break;
		}
	}
	let g = a.filter((e) => e.role !== "accent"), _ = [
		[
			"stone",
			3,
			.34
		],
		[
			"grass",
			6,
			.32
		],
		...n.flowers ? [[
			"flowers",
			6,
			n.id === "garden" ? .52 : .46
		]] : []
	];
	for (let [t, n, a] of _) for (let o = 0; o < n; o++) {
		let n = a * (t === "stone" ? (o === 0 ? 1.7 : .72) + r() * .16 : .75 + r() * .5);
		for (let a = 0; a < 15; a++) {
			let s = r() * Math.PI * 2, l = Math.sqrt(r()) * .8, u = Math.cos(s) * l, d = Math.sin(s) * l;
			if (a < 9 && g.length) {
				let e = t === "flowers" && o < 3 ? g[0] : g[o % g.length];
				t === "flowers" && (s = (e.role === "tree" ? Math.atan2(-e.z, -e.x) : Math.PI / 2) + (r() - .5) * 2.4);
				let i = (e.role === "tree" ? e.radius * .85 : e.supportRadius) + n * (.48 + o % 2 * .16) + .045;
				u = e.x + Math.cos(s) * i, d = e.z + Math.sin(s) * i;
			}
			let f = q(e, "world", u * i, d * i);
			if (!(!f.inside || f.radial > .9) && c(t, "accent", u, d, n, r() * 6.28)) break;
		}
	}
	let v = {
		styleId: n.id,
		props: a,
		pool: o,
		triangles: a.reduce((e, t) => e + Us(t.asset).triangles, 0)
	};
	return Ws.set(e, v), v;
}
//#endregion
//#region src/island/course-meadow-beds.ts
function qs(e, t) {
	let n = br(e), r = Qi(e), i = t.filter((e) => e.kind === "tree"), a = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(e.lessonCount)))), o = [];
	for (let a = -8; a <= 8; a++) for (let s = -8; s <= 8; s++) {
		let c = `meadow/${a}/${s}`, l = L(`${e.seed}/${c}`), u = (a + l * .6 - .3) / 10 * e.bounds.halfX, d = (s + L(`${e.seed}/${c}/z`) * .6 - .3) / 10 * e.bounds.halfZ, f = G(n, u, d);
		if (!f.inside || f.grass < .3 || f.rock > .42 || f.shore > .8) continue;
		let p = 1.65 + l * .55, m = Y(e, {
			x: u,
			z: d
		});
		if (m < r + p + .45 || Math.hypot(u - e.hero.x, d - e.hero.z) < e.hero.radius + p + .8 || e.nodes.some((t) => Math.hypot(t.x - u, t.z - d) < e.route.nodeRadius + p + .8) || t.some((e) => Math.hypot(e.x - u, e.z - d) < (e.kind === "tree" ? (e.height ?? 0) * .14 : e.radius) + p + .2) || !Array.from({ length: 8 }, (e, t) => {
			let r = t * Math.PI / 4;
			return G(n, u + Math.cos(r) * p, d + Math.sin(r) * p).inside;
		}).every(Boolean)) continue;
		let h = i.reduce((e, t) => Math.min(e, Math.hypot(u - t.x, d - t.z)), Infinity);
		o.push({
			id: c,
			x: u,
			z: d,
			radius: p,
			count: 8,
			meadow: !0,
			sheltered: h < 7,
			score: f.grass * 1.4 - f.rock * .7 - Math.abs(m - r - 5) * .045 + l * .28
		});
	}
	o.sort((e, t) => t.score - e.score || e.id.localeCompare(t.id));
	let s = [];
	for (let e of o) {
		if (s.length >= a) break;
		s.some((t) => Math.hypot(t.x - e.x, t.z - e.z) < t.radius + e.radius + 3) || s.push(e);
	}
	return s;
}
//#endregion
//#region src/island/course-garden-edges.ts
function Js(e, t) {
	let n = [];
	if (!e.themeSelection.accentPackIds.includes("fantasy-town-kit")) return n;
	let r = br(e), i = Qi(e), a = Us("fence"), o = t.placements.filter((e) => ["wall-doorway-square", "stall"].includes(e.assetId));
	for (let s of o) {
		if (n.length >= 6) break;
		let o = e.centerline.reduce((e, t) => Math.hypot(t.x - s.x, t.z - s.z) < Math.hypot(e.x - s.x, e.z - s.z) ? t : e, e.centerline[0]), c = Math.hypot(s.x - o.x, s.z - o.z);
		if (c < .01) continue;
		let l = (s.x - o.x) / c, u = (s.z - o.z) / c, d = -u, f = l;
		for (let o of [-1, 1]) {
			let c = !1;
			for (let p of [1.8, 1.45]) {
				let m = a.radius * p, h = a.height * p;
				for (let a of [
					.4,
					1.1,
					-.35
				]) for (let g of [
					1.3,
					2,
					2.7
				]) {
					if (c) break;
					let _ = X(s) + m + g, v = {
						x: s.x + d * _ * o + l * a,
						z: s.z + f * _ * o + u * a
					}, y = G(r, v.x, v.z);
					if (!y.inside || y.shore > .83 || Y(e, v) < i + m + h * .7 || e.nodes.some((t) => Math.hypot(t.x - v.x, t.z - v.z) < e.route.nodeRadius + m + .6) || Math.hypot(e.hero.x - v.x, e.hero.z - v.z) < e.hero.radius + m + .4 || t.placements.some((e) => Math.hypot(e.x - v.x, e.z - v.z) < X(e) + m + .16) || t.landscape?.outcrops.some((e) => Math.hypot(e.x - v.x, e.z - v.z) < e.radius + m + .2) || t.landscape?.spring && Fa(t.landscape.spring, v, m) || n.some((e) => Math.hypot(e.x - v.x, e.z - v.z) < e.radius + m + .2)) continue;
					let b = bi(e, ja(v.x, v.z, m), "course");
					!b || b.maxY - b.minY > .12 || (n.push({
						...v,
						id: `garden-edge/${s.id}/${o}`,
						anchorId: s.id,
						y: b.minY - .012,
						turn: -Math.atan2(u, l),
						size: p,
						radius: m,
						groundRange: [b.minY, b.maxY]
					}), c = !0);
				}
				if (c) break;
			}
		}
	}
	return n;
}
//#endregion
//#region src/island/course-ground-stone.ts
function Ys(e) {
	return e.kind === "rock" && e.packId === "nature-kit" && e.id.startsWith("nature-");
}
function Xs(e, t) {
	let n = Us("stone");
	return t.placements.filter(Ys).flatMap((t) => {
		let r = _o(t.assetId, t.height), i = t.height / n.height, a = Math.min(i * 1.65, Math.min(r.x, r.z) * .49 / n.radius);
		for (let r of [Math.max(i, a), i]) {
			let i = n.radius * r, a = n.height * r;
			if (Y(e, t) < Qi(e) + i + a * .7 || e.nodes.some((n) => Math.hypot(n.x - t.x, n.z - t.z) < e.route.nodeRadius + i + a * .7)) continue;
			let o = bi(e, ja(t.x, t.z, i), "course");
			if (!(!o || o.maxY - o.minY > Math.min(.25, a * .65))) return [{
				id: t.id,
				x: t.x,
				z: t.z,
				y: o.minY - .016,
				turn: t.turn,
				size: r,
				radius: i,
				height: a,
				groundRange: [o.minY, o.maxY]
			}];
		}
		return [];
	});
}
//#endregion
//#region src/island/craft-surface.ts
var Z = {
	natural: 0,
	timber: 1,
	roof: 2,
	plaster: 3,
	cloth: 4,
	glazing: 5
};
function Zs(e, t = Z.natural) {
	if (e.hasAttribute("craftSurface")) return;
	let n = e.getAttribute("position"), r = new Float32Array(n.count * 3);
	if (t !== Z.natural) for (let e = 0; e < n.count; e++) {
		let i = t === Z.roof || t === Z.cloth;
		r[e * 3] = i ? n.getZ(e) : n.getX(e) + n.getZ(e) * .37, r[e * 3 + 1] = i ? n.getX(e) : n.getY(e), r[e * 3 + 2] = t;
	}
	e.setAttribute("craftSurface", new o.BufferAttribute(r, 3));
}
//#endregion
//#region src/island/course-stall-geometry.ts
var Qs = {
	x: .65,
	y: .3655,
	z: 1
}, $s = [
	[-.26, -.43],
	[-.26, .43],
	[.26, -.43],
	[.26, .43]
], ec = 1200;
function tc(e = [
	0,
	0,
	0,
	0
]) {
	if (e.length !== 4 || !e.every((e) => Number.isFinite(e) && Math.abs(e) <= .14)) throw RangeError("The four stall feet must fit their measured ground datums");
	let t = [], n = (e, n, r = Z.timber) => {
		let i = new o.Color(n), a = new Float32Array(e.getAttribute("position").count * 3);
		for (let e = 0; e < a.length; e += 3) a[e] = i.r, a[e + 1] = i.g, a[e + 2] = i.b;
		e.setAttribute("color", new o.BufferAttribute(a, 3)), e.deleteAttribute("uv"), Zs(e, r), e.index || e.setIndex(Array.from({ length: a.length / 3 }, (e, t) => t)), t.push(e);
	}, r = (e, t, r, i = Z.timber) => n(Bt(e).translate(...t), r, i);
	try {
		$s.forEach(([t, n], i) => {
			let a = e[i], o = .31;
			r([
				.034,
				o - a,
				.034
			], [
				t,
				(o + a) / 2,
				n
			], 10185029);
		});
		for (let e of [-.26, .26]) r([
			.03,
			.026,
			.91
		], [
			e,
			.292,
			0
		], 11631184);
		r([
			.3,
			.025,
			.86
		], [
			-.065,
			.181,
			0
		], 13805430), r([
			.026,
			.105,
			.83
		], [
			.065,
			.117,
			0
		], 11368268), r([
			.028,
			.018,
			.86
		], [
			.067,
			.075,
			0
		], 13739382);
		let i = [
			-.325,
			-.28,
			0,
			.28,
			.325
		], a = [
			.282,
			.309,
			Qs.y,
			.309,
			.282
		], s = i.length, c = Array.from({ length: 13 }, (e, t) => i.map((e, n) => new o.Vector3(e, a[n] - (n === 0 || n === 4 ? t % 2 * .009 : 0), -.5 + t / 12))).flat(), l = c.map((e) => e.clone().add(new o.Vector3(0, -.006, 0))), u = [], d = [], f = [], p = (e, t, n, r) => {
			let i = u.length / 3, a = new o.Color(r);
			for (let r of [
				e,
				t,
				n
			]) u.push(r.x, r.y, r.z), d.push(a.r, a.g, a.b);
			f.push(i, i + 1, i + 2);
		};
		for (let e = 0; e < 12; e++) for (let t = 0; t < s - 1; t++) {
			let n = e * s + t, r = n + 1, i = n + s, a = i + 1, o = Math.floor(e / 2) % 2 == 0 ? 14657142 : 15915949;
			p(c[n], c[i], c[r], o), p(c[r], c[i], c[a], o), p(l[n], l[r], l[i], 14203796), p(l[r], l[a], l[i], 14203796);
		}
		let m = [
			...Array.from({ length: s }, (e, t) => t),
			...Array.from({ length: 12 }, (e, t) => (t + 1) * s + s - 1),
			...Array.from({ length: s - 1 }, (e, t) => 13 * s - 2 - t),
			...Array.from({ length: 11 }, (e, t) => (11 - t) * s)
		];
		for (let e = 0; e < m.length; e++) {
			let t = m[e], n = m[(e + 1) % m.length];
			p(c[t], c[n], l[t], 15387543), p(c[n], l[n], l[t], 15387543);
		}
		let h = new o.BufferGeometry();
		h.setAttribute("position", new o.Float32BufferAttribute(u, 3)), h.setAttribute("color", new o.Float32BufferAttribute(d, 3)), h.setIndex(f), h.computeVertexNormals(), Zs(h, Z.cloth), t.push(h), r([
			.12,
			.022,
			.14
		], [
			-.03,
			.205,
			-.22
		], 5278873, Z.natural), r([
			.105,
			.012,
			.13
		], [
			-.024,
			.222,
			-.215
		], 15326132, Z.natural), r([
			.115,
			.017,
			.13
		], [
			-.04,
			.237,
			-.2
		], 11041101, Z.natural), n(new o.CylinderGeometry(.037, .026, .046, 8, 1).translate(-.06, .217, .25), 12024401, Z.natural);
		let g = U("grass").scale(.19, .19, .19).translate(-.06, .24, .25);
		Zs(g), t.push(g);
		let _ = ie(t, !1);
		if (!_) throw Error("Stall parts must share the existing landscape vertex format");
		if ((_.index?.count ?? 0) / 3 > 1200) throw _.dispose(), Error("Stall geometry budget exceeded");
		return _.computeBoundingBox(), _.computeBoundingSphere(), _;
	} finally {
		t.forEach((e) => e.dispose());
	}
}
//#endregion
//#region src/island/course-stall-plan.ts
var nc = (e) => e.packId === "fantasy-town-kit" && e.assetId === "stall";
function rc(e, t) {
	return t.placements.filter(nc).flatMap((t) => {
		let n = t.height / Qs.y;
		if (!(n > 0) || !Number.isFinite(n)) return [];
		let r = (e, r) => ({
			x: t.x + (e * Math.cos(t.turn) + r * Math.sin(t.turn)) * n,
			z: t.z + (-e * Math.sin(t.turn) + r * Math.cos(t.turn)) * n
		}), i = $s.map(([i, a]) => {
			let o = bi(e, [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1]
			].map(([e, t]) => r(i + e * .017, a + t * .017)), "course");
			return !o || o.maxY - o.minY > .08 ? null : (o.minY - .008 - t.y) / n;
		});
		return i.some((e) => e === null || !Number.isFinite(e) || Math.abs(e) > .14) ? [] : [{
			id: t.id,
			x: t.x,
			y: t.y,
			z: t.z,
			turn: t.turn,
			size: n,
			feet: i
		}];
	});
}
//#endregion
//#region src/island/course-shoulder-canopy.ts
function ic(e, t, n) {
	let r = [], i = t.placements.filter((e) => e.kind === "tree").map((e) => ({
		...e,
		y: e.y + (e.foliageRootOffset ?? 0),
		form: Ha(e.foliageShapeSeed ?? e.id, e.x, e.z) ? "fir" : "broadleaf"
	}));
	for (let t of n) {
		if (t.feature === "ruin") continue;
		let n = Oa(t);
		for (let [a, [o, s]] of [[-.26, .17], [.42, -.1]].entries()) {
			let c = Math.min(3.8, Math.max(1.7, t.radius * (a ? .3 : .43))), l = c * .44, u = t.x + (o * Math.cos(t.turn) - s * Math.sin(t.turn)) * t.radius, d = t.z + (o * Math.sin(t.turn) + s * Math.cos(t.turn)) * t.radius;
			if (Math.hypot(u - t.x, d - t.z) + l > t.radius || Y(e, {
				x: u,
				z: d
			}) < Qi(e) + l + (t.height + c) * 1.4 || e.nodes.some((n) => Math.hypot(u - n.x, d - n.z) < e.route.nodeRadius + l + (t.height + c) * 1.4)) continue;
			let f = [{
				x: u,
				z: d
			}, ...ja(u, d, c * .12)].map((e) => ka(n, e.x, e.z));
			if (f.some((e) => e === null)) continue;
			let p = Math.min(...f), m = Math.max(...f);
			if (m - p > .14) continue;
			let h = a ? "broadleaf" : "fir", g = {
				x: u,
				y: p - .012,
				z: d,
				height: c,
				form: h
			};
			i.some((e) => !Ka(g, e)) || r.some((e) => !Ka(g, {
				...e,
				height: e.size,
				form: e.asset
			})) || r.push({
				id: `${t.id}/canopy/${a}`,
				supportId: t.id,
				asset: h,
				x: u,
				z: d,
				y: g.y,
				size: c,
				radius: l,
				turn: L(`${e.seed}/${t.id}/canopy/${a}`) * Math.PI * 2,
				groundRange: [p, m]
			});
		}
	}
	return r;
}
//#endregion
//#region src/island/course-academy-plan.ts
function ac(e, t) {
	let n = t.placements.filter((e) => e.assemblyId === "summit-academy-building"), r = n.find((e) => e.assetId === "roof-gable"), i = n.find((e) => e.assetId === "wall-doorway-square");
	if (!r || !i || n.length !== 5 || n.filter((e) => e.assetId === "wall").length !== 3) return [];
	let a = i.height, o = Math.atan2(i.x - r.x, i.z - r.z), s = bi(e, [
		[-.49, -.49],
		[.49, -.49],
		[.49, .49],
		[-.49, .49]
	].map(([e, t]) => ({
		x: r.x + (e * Math.cos(o) + t * Math.sin(o)) * a,
		z: r.z + (-e * Math.sin(o) + t * Math.cos(o)) * a
	})), "course");
	if (!s || s.maxY - s.minY > .22) return [];
	let c = (s.minY - .012 - i.y) / a;
	return c < -.16 || c > .02 ? [] : [{
		id: "summit-academy-building",
		sourceIds: n.map((e) => e.id),
		x: r.x,
		y: i.y,
		z: r.z,
		turn: o,
		size: a,
		foundationY: c
	}];
}
//#endregion
//#region src/island/course-academy-geometry.ts
var oc = 3400, Q = {
	plaster: 9483452,
	wood: 10974799,
	edge: 12948063,
	roof: 4234136,
	roofEdge: 3636860,
	stone: 12040101,
	glass: 12115934,
	inner: 12171155
}, sc = /* @__PURE__ */ new Map([
	[Q.plaster, Z.plaster],
	[Q.wood, Z.timber],
	[Q.edge, Z.timber],
	[Q.roof, Z.roof],
	[Q.roofEdge, Z.roof],
	[Q.glass, Z.glazing]
]);
function cc(e = -.04) {
	if (!Number.isFinite(e) || e > .02 || e < -.16) throw RangeError("Academy foundation must stay in its fitted ground allowance");
	let t = [], n = (e, n) => {
		let r = new o.Color(n), i = new Float32Array(e.attributes.position.count * 3);
		for (let e = 0; e < i.length; e += 3) r.toArray(i, e);
		return e.setAttribute("color", new o.BufferAttribute(i, 3)), e.deleteAttribute("uv"), e.clearGroups(), Zs(e, sc.get(n) ?? Z.natural), t.push(e), e;
	}, r = (e, t, r, i, a, o, s, c = 0) => n(Bt([
		e,
		t,
		r
	], Math.min(e, t, r) * .15).rotateZ(c).translate(i, a, o), s), i = (e, t, r, i) => {
		let a = [.../* @__PURE__ */ new Set([
			-.46,
			.46,
			...e.flatMap((e) => [e[0], e[1]])
		])].sort((e, t) => e - t), s = [.../* @__PURE__ */ new Set([
			.035,
			1,
			...e.flatMap((e) => [e[2], e[3]])
		])].sort((e, t) => e - t), c = [], l = [], u = (e, t, n, r) => {
			let i = c.length / 3;
			c.push(...e, ...t, ...n, ...r), l.push(i, i + 1, i + 2, i, i + 2, i + 3);
		}, d = (t, n) => t >= 0 && n >= 0 && t < a.length - 1 && n < s.length - 1 && !e.some((e) => (a[t] + a[t + 1]) / 2 > e[0] && (a[t] + a[t + 1]) / 2 < e[1] && (s[n] + s[n + 1]) / 2 > e[2] && (s[n] + s[n + 1]) / 2 < e[3]), f = .031;
		for (let e = 0; e < a.length - 1; e++) for (let t = 0; t < s.length - 1; t++) {
			if (!d(e, t)) continue;
			let n = a[e], r = a[e + 1], i = s[t], o = s[t + 1];
			u([
				n,
				i,
				f
			], [
				r,
				i,
				f
			], [
				r,
				o,
				f
			], [
				n,
				o,
				f
			]), u([
				r,
				i,
				-.031
			], [
				n,
				i,
				-.031
			], [
				n,
				o,
				-.031
			], [
				r,
				o,
				-.031
			]), d(e - 1, t) || u([
				n,
				i,
				-.031
			], [
				n,
				i,
				f
			], [
				n,
				o,
				f
			], [
				n,
				o,
				-.031
			]), d(e + 1, t) || u([
				r,
				i,
				f
			], [
				r,
				i,
				-.031
			], [
				r,
				o,
				-.031
			], [
				r,
				o,
				f
			]), d(e, t - 1) || u([
				n,
				i,
				-.031
			], [
				r,
				i,
				-.031
			], [
				r,
				i,
				f
			], [
				n,
				i,
				f
			]), d(e, t + 1) || u([
				n,
				o,
				f
			], [
				r,
				o,
				f
			], [
				r,
				o,
				-.031
			], [
				n,
				o,
				-.031
			]);
		}
		let p = new o.BufferGeometry();
		p.setAttribute("position", new o.Float32BufferAttribute(c, 3)), p.setIndex(l), p.computeVertexNormals(), n(p.rotateY(i).translate(t, 0, r), Q.plaster);
	};
	try {
		let a = [
			-.16,
			.16,
			.035,
			.72
		], s = [
			-.2,
			.2,
			.43,
			.76
		];
		i([a], 0, .455, 0), i([s], 0, -.455, Math.PI), i([s], .455, 0, Math.PI / 2), i([s], -.455, 0, -Math.PI / 2), r(.98, .055 - e, .98, 0, (e + .055) / 2, 0, Q.stone);
		for (let e of [-.459, .459]) for (let t of [-.459, .459]) r(.068, 1.01, .068, e, .505, t, Q.wood);
		for (let e of [-.47, .47]) r(.98, .064, .062, 0, .967, e, Q.edge);
		for (let e of [-.47, .47]) r(.062, .064, .98, e, .967, 0, Q.edge);
		for (let e of [-.185, .185]) r(.045, .736, .073, e, .388, .463, Q.edge);
		r(.415, .048, .073, 0, .742, .463, Q.edge);
		for (let e of [
			Math.PI,
			Math.PI / 2,
			-Math.PI / 2
		]) {
			let n = t.length;
			for (let e of [-.221, .221]) r(.042, .386, .073, e, .595, .458, Q.edge);
			for (let e of [.41, .783]) r(.49, .04, .073, 0, e, .458, Q.edge);
			r(.026, .326, .034, 0, .596, .466, Q.wood), r(.388, .025, .034, 0, .597, .466, Q.wood), r(.394, .324, .008, 0, .596, .446, Q.glass), r(.5, .042, .112, 0, .397, .46, Q.wood);
			for (let r of t.slice(n)) r.rotateY(e);
		}
		for (let e of [-.45, .45]) {
			let t = new o.Shape();
			t.moveTo(-.46, 1), t.lineTo(.46, 1), t.lineTo(0, 1.5), t.closePath();
			let r = new o.ExtrudeGeometry(t, {
				depth: .045,
				bevelEnabled: !0,
				bevelThickness: .006,
				bevelSize: .005,
				bevelSegments: 1,
				steps: 1
			});
			r.index || r.setIndex(Array.from({ length: r.attributes.position.count }, (e, t) => t)), n(r.translate(0, 0, e - .0225), Q.plaster);
		}
		let c = .54, l = .535, u = Math.atan2(c, l), d = Math.hypot(c, l);
		for (let e of [-1, 1]) {
			r(d, .028, 1.052, e * l / 2, 1.275, 0, Q.roof, -e * u);
			for (let t of [-.504, .504]) r(d, .035, .042, e * l / 2, 1.256, t, Q.roofEdge, -e * u);
		}
		r(.065, .035, 1.058, 0, 1.545, 0, Q.roofEdge);
		let f = ie(t, !1);
		if (!f) throw Error("Academy material attributes disagree");
		if (f.computeBoundingBox(), f.computeBoundingSphere(), f.index.count / 3 > 3400) throw f.dispose(), Error("Academy geometry exceeds its budget");
		return f;
	} finally {
		t.forEach((e) => e.dispose());
	}
}
//#endregion
//#region src/island/course-landscape-plan.ts
function lc(e) {
	return /* @__PURE__ */ new Set([...[...e.stones ?? [], ...e.stalls ?? []].map((e) => e.id), ...(e.academies ?? []).flatMap((e) => e.sourceIds)]);
}
var uc = /* @__PURE__ */ new WeakMap();
function dc(e, t) {
	let n = uc.get(e)?.get(t);
	if (n) return n;
	let r = br(e), i = Qi(e), a = t.placements.map((e) => ({
		...e,
		radius: X(e)
	})), o = t.landscape?.outcrops ?? [], s = t.landscape?.spring ?? null, c = [], l = Js(e, t), u = Xs(e, t), d = rc(e, t), f = ic(e, t, o), p = ac(e, t), m = qs(e, [
		...a,
		...o,
		...l
	]).filter((e) => !s || !Fa(s, e, e.radius)), h = [
		...l.map((e) => ({
			...e,
			count: 4,
			baseCount: 2
		})),
		...o.map((e) => ({
			id: e.id,
			x: e.x,
			z: e.z,
			radius: e.radius,
			count: 14,
			baseCount: 10
		})),
		...a.filter((e) => e.kind !== "bush").map((e) => ({
			id: e.id,
			x: e.x,
			z: e.z,
			radius: e.radius,
			count: 6,
			baseCount: e.kind === "tree" ? 3 : 4,
			sheltered: e.kind === "tree"
		})),
		...m.map((e) => ({
			...e,
			baseCount: 0
		}))
	], g = o.reduce((e, t) => e + (t.feature === "ruin" ? Aa.ruinTriangles : Aa.outcropTriangles), 0);
	s && (g += Na), g += l.length * Us("fence").triangles, g += u.length * Us("stone").triangles, g += d.length * ec, g += f.reduce((e, t) => e + Ht[t.asset], 0), g += p.length * oc;
	for (let t of h) {
		let n = R(`${e.seed}/flora/${t.id}`), u = e.centerline.reduce((e, n) => Math.hypot(n.x - t.x, n.z - t.z) < Math.hypot(e.x - t.x, e.z - t.z) ? n : e, e.centerline[0]), d = Math.atan2(u.z - t.z, u.x - t.x);
		for (let u = 0; u < t.count && !(c.length >= Aa.flora); u++) {
			let f = t.meadow ? u === 0 ? "leafy" : u === 2 ? "flowers" : u === 3 && t.sheltered ? "mushroom" : u % 2 ? "grass" : "fern" : u < t.baseCount ? u % 5 == 2 ? "fern" : u % 3 == 2 ? "grass" : "flowers" : u % 3 == 0 && t.sheltered ? "mushroom" : u % 2 ? "leafy" : "grass", p = Us(f).triangles;
			if (g + p > Aa.triangles) continue;
			let m = f === "flowers" ? (t.meadow ? 1.75 : 2.1) + n() * .65 : f === "fern" ? 1.2 + n() * .5 : f === "leafy" ? 1.7 + n() * .5 : f === "mushroom" ? 1.2 + n() * .5 : 2.2 + n() * .9;
			for (let h = 0; h < 14; h++) {
				let _ = m * (h >= 10 ? .76 : 1), v = Us(f).radius * _, y = d + (n() - .5) * (t.meadow ? 5.2 : 2.1), b = t.meadow ? Math.sqrt(n()) * Math.max(0, t.radius - v - .04) : t.radius + v + .22 + n() * .85, x = t.x + Math.cos(y) * b, S = t.z + Math.sin(y) * b, C = G(r, x, S);
				if (!C.inside || C.shore > .84 || C.grass < .05 || s && Fa(s, {
					x,
					z: S
				}, v) || Y(e, {
					x,
					z: S
				}) < i + v + .16 || e.nodes.some((t) => Math.hypot(t.x - x, t.z - S) < e.route.nodeRadius + v + .5) || o.some((e) => Math.hypot(e.x - x, e.z - S) < e.radius + v + .1) || l.some((e) => Math.hypot(e.x - x, e.z - S) < e.radius + v + .04) || a.some((e) => Math.hypot(e.x - x, e.z - S) < (e.kind === "tree" ? e.height * .12 : e.radius) + v + .08) || c.some((e) => Math.hypot(e.x - x, e.z - S) < e.radius + v + .04)) continue;
				let w = bi(e, ja(x, S, v, 8), "course");
				if (!(!w || w.maxY - w.minY > .15)) {
					c.push({
						id: `${t.id}/${u}`,
						asset: f,
						x,
						z: S,
						y: w.minY - .012,
						size: _,
						radius: v,
						turn: n() * Math.PI * 2,
						anchorId: t.id,
						groundRange: [w.minY, w.maxY]
					}), g += p;
					break;
				}
			}
		}
	}
	for (let t of o) {
		if (t.feature === "ruin") continue;
		let n = Oa(t);
		for (let [r, a] of [
			[-.12, -.42],
			[.11, .07],
			[-.02, .39]
		].entries()) {
			let o = r === 1 ? "flowers" : "fern", s = o === "flowers" ? 1.45 : 1.65, l = Us(o), u = s * l.radius;
			if (c.length >= Aa.flora || g + l.triangles > Aa.triangles) continue;
			let d = t.x + (a[0] * Math.cos(t.turn) - a[1] * Math.sin(t.turn)) * t.radius, p = t.z + (a[0] * Math.sin(t.turn) + a[1] * Math.cos(t.turn)) * t.radius;
			if (Y(e, {
				x: d,
				z: p
			}) < i + u + (t.height + s * l.height) * 1.4) continue;
			let m = [{
				x: d,
				z: p
			}, ...ja(d, p, u)].map((e) => ka(n, e.x, e.z));
			if (m.some((e) => e === null)) continue;
			let h = m, _ = Math.min(...h), v = Math.max(...h);
			v - _ > .12 || f.some((e) => Math.hypot(e.x - d, e.z - p) < e.size * .13 + u + .05) || (c.push({
				id: `${t.id}/shoulder/${r}`,
				anchorId: t.id,
				supportId: t.id,
				asset: o,
				x: d,
				z: p,
				y: _ - .012,
				size: s,
				radius: u,
				turn: t.turn + r * 1.7,
				groundRange: [_, v]
			}), g += l.triangles);
		}
	}
	let _ = {
		outcrops: o,
		flora: c,
		meadowBeds: m.filter((e) => c.some((t) => t.anchorId === e.id)),
		borders: l,
		stones: u,
		stalls: d,
		canopy: f,
		academies: p,
		spring: s,
		search: t.landscape?.search ?? {}
	}, v = uc.get(e);
	return v || (v = /* @__PURE__ */ new WeakMap(), uc.set(e, v)), v.set(t, _), _;
}
//#endregion
//#region src/island/island-foliage-render.tsx
function fc({ placements: i }) {
	let a = r(null), s = n(() => i.flatMap((e) => It(e)), [i]), c = n(() => Pt(1, 1.2), []), l = n(() => new o.MeshStandardMaterial({
		color: 16777215,
		roughness: .92,
		metalness: 0,
		flatShading: !1
	}), []);
	return t(() => {
		let e = a.current;
		if (!e) return;
		let t = new o.Object3D();
		s.forEach((n, r) => {
			t.position.copy(n.position), t.quaternion.copy(n.quaternion), t.scale.copy(n.scale), t.updateMatrix(), e.setMatrixAt(r, t.matrix), e.setColorAt(r, n.color);
		}), e.instanceMatrix.needsUpdate = !0, e.instanceColor && (e.instanceColor.needsUpdate = !0), e.computeBoundingBox(), e.computeBoundingSphere();
	}, [s]), e(() => () => {
		c.dispose(), l.dispose();
	}, [c, l]), s.length ? /* @__PURE__ */ (0, z.jsx)("instancedMesh", {
		ref: a,
		name: "course-bush-crowns",
		args: [
			c,
			l,
			s.length
		],
		castShadow: !0,
		frustumCulled: !1,
		userData: {
			islandLookFoliageInstanceCount: s.length,
			islandLookCrownTrianglesPerLobe: 80,
			islandLookCrownLobesPerPlacement: 3,
			islandLookPlacementCount: i.length
		}
	}) : null;
}
function pc(e) {
	return e.packId === "elemental-serenity" && (e.assetId === "treeTrunks" || e.assetId === "bushEmitter");
}
function mc(e, t) {
	return {
		treeForm: Ha(e.foliageShapeSeed ?? e.id, e.x, e.z) ? "fir" : "broadleaf",
		position: new o.Vector3(e.x * t, (e.y + (e.foliageRootOffset ?? 0)) * t, e.z * t),
		height: e.height * t,
		turn: e.turn,
		foliageTint: e.foliageTint,
		shapeSeed: e.foliageShapeSeed,
		groundOffsets: e.foliageGroundOffsets?.map((e) => e * t)
	};
}
function hc({ plan: e, scale: t }) {
	let r = n(() => e.placements.filter((e) => e.assetId === "treeTrunks").map((e) => mc(e, t)), [e, t]), i = n(() => r.filter((e) => e.treeForm === "fir"), [r]), a = n(() => r.filter((e) => e.treeForm === "broadleaf"), [r]), o = n(() => e.placements.filter((e) => e.assetId === "bushEmitter").map((e) => mc(e, t)), [e, t]);
	return /* @__PURE__ */ (0, z.jsxs)(z.Fragment, { children: [
		/* @__PURE__ */ (0, z.jsx)(wn, {
			kind: "fir",
			placements: i
		}),
		/* @__PURE__ */ (0, z.jsx)(wn, {
			kind: "broadleaf",
			placements: a
		}),
		o.length ? /* @__PURE__ */ (0, z.jsx)(fc, { placements: o }) : null
	] });
}
//#endregion
//#region src/page-visibility.ts
function gc() {
	return typeof document > "u" || !document.hidden;
}
function _c(e) {
	return typeof document > "u" ? () => {} : (document.addEventListener("visibilitychange", e), () => document.removeEventListener("visibilitychange", e));
}
function vc() {
	return a(_c, gc, () => !0);
}
//#endregion
//#region src/reduced-motion.ts
var yc = /* @__PURE__ */ new WeakMap();
function bc() {
	if (typeof window > "u" || typeof window.matchMedia != "function") return null;
	let e = yc.get(window);
	if (e?.matchMedia === window.matchMedia) return e.media;
	let t = window.matchMedia("(prefers-reduced-motion: reduce)");
	return yc.set(window, {
		matchMedia: window.matchMedia,
		media: t
	}), t;
}
function xc() {
	return bc()?.matches ?? !1;
}
function Sc(e) {
	let t = bc();
	return t ? (t.addEventListener("change", e), () => t.removeEventListener("change", e)) : () => {};
}
var Cc = () => !1;
function wc() {
	return a(Sc, xc, Cc);
}
//#endregion
//#region src/island/island-campfire.ts
var Tc = .32, Ec = {
	min: new o.Vector3(-6.9904248, -.1423323, -8.2678017),
	max: new o.Vector3(-4.2944571, .5878592, -5.7650673),
	size: new o.Vector3(2.6959677, .7301915, 2.5027344),
	center: new o.Vector3(-5.642441, .2227634, -7.0164345)
}, Dc = {
	min: new o.Vector3(-6.4786425, .0234348, -7.8415643),
	max: new o.Vector3(-4.7499701, .5878592, -6.2075498),
	size: new o.Vector3(1.7286724, .5644244, 1.6340145),
	center: new o.Vector3(-5.6143063, .305647, -7.0245571)
}, Oc = .55;
function kc(e, t, n = Oc) {
	let r = e.size.y, i = t.min.y + t.size.y * n;
	return new o.Vector3((t.center.x - e.center.x) / r, (i - e.min.y) / r, (t.center.z - e.center.z) / r);
}
function Ac(e = Ec, t = Dc) {
	return kc(e, t);
}
var jc = Ac();
function Mc(e, t, n = {}) {
	return n.reducedMotion || n.paused || !Number.isFinite(t) || t <= 0 || t > (n.maxStep ?? .1) ? e : e + t;
}
function Nc(e, t) {
	return 1 + .038 * Math.sin(e * 11 + t * 1.7) + .018 * Math.cos(e * 19 + t * 2.9);
}
var Pc = .4, Fc = .26;
function Ic(e) {
	return e.packId === "elemental-serenity" && e.assetId === "camp" && e.state === "lit";
}
function Lc(e) {
	return e.filter(Ic);
}
function Rc(e, t = 1, n = 1) {
	let r = e.height, i = r / Tc, a = r * t * n, s = new o.Vector3(e.x * t, e.y * t, e.z * t), c = Math.cos(e.turn), l = Math.sin(e.turn), u = jc.x * a, d = jc.y * a, f = jc.z * a, p = new o.Vector3(s.x + (u * c + f * l), s.y + d, s.z + (-u * l + f * c)), m = Fc * i * t * n, h = Pc * i * t * n, g = new o.Quaternion().setFromAxisAngle(new o.Vector3(0, 1, 0), e.turn), _ = new o.Vector3(m, h, m), v = new o.Matrix4();
	return v.compose(p, g, _), v;
}
function zc() {
	let e = new o.BufferGeometry(), t = [], n = [], r = [], i = new o.Color(16775360), a = new o.Color(16758835), s = new o.Color(16747546), c = new o.Color(14231040);
	for (let e = 0; e < 6; e += 1) {
		let r = e / 6 * Math.PI * 2;
		t.push(Math.cos(r) * .42, 0, Math.sin(r) * .42), i.toArray(n, n.length);
	}
	for (let e = 0; e < 6; e += 1) {
		let r = e / 6 * Math.PI * 2 + .18;
		t.push(Math.cos(r) * .5, .45, Math.sin(r) * .5), a.toArray(n, n.length);
	}
	t.push(.04, 1, -.03), c.toArray(n, n.length);
	for (let e = 0; e < 6; e += 1) {
		let t = (e + 1) % 6, n = e, i = t, a = 6 + e, o = 6 + t;
		r.push(n, a, o), r.push(n, o, i), r.push(a, 12, o);
	}
	let l = new o.Color(16775904), u = new o.Color(16765286), d = new o.Color(s);
	return t.push(0, .04, .44), l.toArray(n, n.length), t.push(-.07, .28, .47), u.toArray(n, n.length), t.push(.08, .25, .47), u.toArray(n, n.length), t.push(0, .48, .42), d.toArray(n, n.length), t.push(.03, .66, .32), c.toArray(n, n.length), r.push(13, 15, 14), r.push(14, 15, 16), r.push(14, 16, 17), r.push(15, 17, 16), e.setAttribute("position", new o.Float32BufferAttribute(t, 3)), e.setAttribute("color", new o.Float32BufferAttribute(n, 3)), e.setIndex(r), e.computeVertexNormals(), e;
}
function Bc() {
	return new o.MeshBasicMaterial({
		vertexColors: !0,
		toneMapped: !0,
		side: o.DoubleSide
	});
}
//#endregion
//#region src/island/island-campfire-render.tsx
var Vc = new o.Matrix4(), Hc = new o.Vector3(), Uc = new o.Quaternion(), Wc = new o.Vector3();
function Gc({ plan: i, scale: a = 1, heightMultiplier: o = 1 }) {
	let s = r(null), c = n(() => Lc(i.placements), [i.placements]), l = n(() => zc(), []), u = n(() => Bc(), []);
	e(() => () => {
		l.dispose(), u.dispose();
	}, [l, u]);
	let d = n(() => c.map((e) => Rc(e, a, o)), [
		c,
		a,
		o
	]);
	t(() => {
		let e = s.current;
		e && d.length !== 0 && (d.forEach((t, n) => {
			e.setMatrixAt(n, t);
		}), e.instanceMatrix.needsUpdate = !0);
	}, [d]);
	let f = wc(), p = vc(), m = r(0);
	return t(() => {
		if (f) {
			let e = s.current;
			if (!e || d.length === 0) return;
			d.forEach((t, n) => {
				e.setMatrixAt(n, t);
			}), e.instanceMatrix.needsUpdate = !0;
		}
	}, [f, d]), ee((e, t) => {
		if (f || !s.current || d.length === 0) return;
		let n = s.current;
		m.current = Mc(m.current, t, {
			reducedMotion: f,
			paused: !p || !gc()
		});
		let r = m.current;
		for (let e = 0; e < d.length; e += 1) d[e].decompose(Hc, Uc, Wc), Wc.y *= Nc(r, e), Vc.compose(Hc, Uc, Wc), n.setMatrixAt(e, Vc);
		n.instanceMatrix.needsUpdate = !0;
	}), c.length === 0 ? null : /* @__PURE__ */ (0, z.jsx)("instancedMesh", {
		ref: s,
		args: [
			l,
			u,
			c.length
		],
		frustumCulled: !1,
		castShadow: !1,
		receiveShadow: !1,
		name: "island-campfire-flames"
	});
}
//#endregion
//#region src/island/island-surface-style.ts
var Kc = "diorama", qc = "island-surface-uniforms-1", Jc = {
	diorama: {
		id: "diorama",
		variant: 0,
		tint: [
			.96,
			1.02,
			.9
		],
		saturation: 1.02,
		contrast: 1.035,
		brightness: 0,
		macroAmount: .22,
		shimmer: 0,
		strength: { terrain: .22 }
	},
	elemental: {
		id: "elemental",
		variant: 1,
		tint: [
			.24,
			.52,
			.32
		],
		saturation: 1.05,
		contrast: 1.08,
		brightness: 0,
		macroAmount: .34,
		shimmer: .003,
		strength: { terrain: .62 }
	},
	mossy: {
		id: "mossy",
		variant: 2,
		tint: [
			.18,
			.42,
			.12
		],
		saturation: 1.05,
		contrast: 1.05,
		brightness: -.012,
		macroAmount: .55,
		shimmer: 0,
		strength: { terrain: .82 }
	},
	desert: {
		id: "desert",
		variant: 3,
		tint: [
			.78,
			.48,
			.18
		],
		saturation: .92,
		contrast: 1.05,
		brightness: .01,
		macroAmount: .72,
		shimmer: 0,
		strength: { terrain: .92 }
	}
}, Yc = "/* university island surface style v1 */", Xc = "#include <color_fragment>", Zc = "#include <project_vertex>", Qc = "#include <common>", $c = `${Yc}
uniform vec3 uIslandStyleTint;
uniform float uIslandStyleSaturation;
uniform float uIslandStyleContrast;
uniform float uIslandStyleBrightness;
uniform float uIslandStyleStrength;
uniform float uIslandStyleVariant;
uniform float uIslandStyleMacroAmount;
uniform float uIslandStyleShimmer;
uniform float uIslandStyleTime;
varying vec3 vIslandStyleWorldPosition;
varying float vIslandStyleHeight;
varying float vIslandStyleSlope;

float universityIslandStyleHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float universityIslandStyleNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 fraction = fract(point);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  float lower = mix(
    universityIslandStyleHash(cell),
    universityIslandStyleHash(cell + vec2(1.0, 0.0)),
    fraction.x
  );
  float upper = mix(
    universityIslandStyleHash(cell + vec2(0.0, 1.0)),
    universityIslandStyleHash(cell + vec2(1.0, 1.0)),
    fraction.x
  );
  return mix(lower, upper, fraction.y);
}`, el = "vec3 islandStyleColour = diffuseColor.rgb;\nfloat islandStyleLuma = dot(islandStyleColour, vec3(0.299, 0.587, 0.114));\nislandStyleColour = mix(vec3(islandStyleLuma), islandStyleColour, uIslandStyleSaturation);\nislandStyleColour = (islandStyleColour - vec3(0.5)) * uIslandStyleContrast + vec3(0.5);\nislandStyleColour = max(vec3(0.0), islandStyleColour + vec3(uIslandStyleBrightness));\nfloat islandStyleOctaveA = universityIslandStyleNoise(vIslandStyleWorldPosition.xz * 0.085);\nfloat islandStyleOctaveB = universityIslandStyleNoise(\n  vIslandStyleWorldPosition.xz * 0.19 + vec2(17.3, 5.1)\n);\nfloat islandStyleMacro = mix(islandStyleOctaveA, islandStyleOctaveB, 0.32);\nfloat islandStyleHeightLayer = smoothstep(-0.2, 3.4, vIslandStyleHeight);\nfloat islandStyleSlopeLayer = smoothstep(0.18, 0.74, vIslandStyleSlope);\nfloat islandStyleMacroMask = smoothstep(\n  0.22,\n  0.78,\n  islandStyleMacro * 0.76 + islandStyleHeightLayer * 0.18 - islandStyleSlopeLayer * 0.14\n);\n// Three cheap roles borrow the donor's explicit ground masks without donor\n// bitmaps: broad macro variation chooses grass versus exposed soil, height\n// makes lower areas a little earthier, and slope supplies contact/cliff depth.\nfloat islandStyleGrassLayer = clamp(\n  islandStyleMacroMask *\n    smoothstep(0.18, 0.74, islandStyleHeightLayer) *\n    (1.0 - islandStyleSlopeLayer * 0.82),\n  0.0,\n  1.0\n);\nfloat islandStyleSoilLayer = clamp(\n  smoothstep(0.28, 0.72, 1.0 - islandStyleMacroMask) *\n    (0.72 + (1.0 - islandStyleHeightLayer) * 0.28) *\n    (1.0 - islandStyleSlopeLayer * 0.42),\n  0.0,\n  1.0\n);\nfloat islandStyleRoleAmount = clamp(\n  0.20 + uIslandStyleMacroAmount * 0.55,\n  0.0,\n  0.70\n);\nvec3 islandStyleGrassTone = mix(\n  vec3(1.04, 1.08, 0.96),\n  min(\n    vec3(1.1),\n    max(vec3(0.0), uIslandStyleTint * 0.42 + vec3(0.62, 0.66, 0.56))\n  ),\n  0.24\n);\nvec3 islandStyleSoilTone = mix(\n  vec3(0.96, 0.90, 0.78),\n  vec3(0.82, 0.74, 0.62),\n  0.36 + (1.0 - islandStyleHeightLayer) * 0.32\n);\nvec3 islandStyleSlopeTone = mix(\n  vec3(0.94, 0.97, 0.88),\n  vec3(0.64, 0.69, 0.62),\n  islandStyleSlopeLayer\n);\nislandStyleColour = mix(\n  islandStyleColour,\n  islandStyleColour * islandStyleGrassTone,\n  islandStyleGrassLayer * islandStyleRoleAmount\n);\nislandStyleColour = mix(\n  islandStyleColour,\n  islandStyleColour * islandStyleSoilTone,\n  islandStyleSoilLayer * islandStyleRoleAmount * 0.90\n);\nislandStyleColour = mix(\n  islandStyleColour,\n  islandStyleColour * islandStyleSlopeTone,\n  islandStyleSlopeLayer * islandStyleRoleAmount\n);\n// A restrained micro layer keeps the procedural top from reading like one\n// untextured card. It is analytic (no donor bitmap or extra texture upload)\n// and remains a subtle modulation of the baked vertex colours, without\n// introducing a second material or draw.\nfloat islandStyleMicro = universityIslandStyleNoise(\n  vIslandStyleWorldPosition.xz * 0.52 + vec2(4.2, 9.1)\n);\nfloat islandStyleMicroTone = mix(0.91, 1.09, islandStyleMicro);\nfloat islandStyleMicroAmount = clamp(0.16 + uIslandStyleMacroAmount * 0.6, 0.0, 1.0);\nislandStyleColour *= mix(1.0, islandStyleMicroTone, islandStyleMicroAmount);\nislandStyleColour += vec3(\n  sin(uIslandStyleTime * 1.7 + dot(vIslandStyleWorldPosition.xz, vec2(0.14, 0.09)))\n  * uIslandStyleShimmer\n);\ndiffuseColor.rgb = mix(diffuseColor.rgb, islandStyleColour, clamp(uIslandStyleStrength, 0.0, 1.0));", tl = `${Yc}
varying vec3 vIslandStyleWorldPosition;
varying float vIslandStyleHeight;
varying float vIslandStyleSlope;`, nl = "\nvIslandStyleWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvIslandStyleHeight = transformed.y;\n// The island never tilts its local up axis. Object-space normal therefore gives\n// a camera-stable slope; transformedNormal is view-space and would make the\n// terrain bands swim when the camera orbits.\nvIslandStyleSlope = 1.0 - clamp(abs(normalize(objectNormal).y), 0.0, 1.0);";
function rl(e) {
	return Jc[e];
}
var il = {
	shot: null,
	seed: null,
	freeze: !1,
	post: !0
};
function al(e = typeof window > "u" ? void 0 : window.location?.search) {
	return il;
}
function ol() {
	let e = al();
	return e.shot !== null && e.freeze;
}
function sl(e, t) {
	return e.strength[t];
}
function cl(e) {
	return `${qc}/${e}`;
}
function ll(e, t = Kc, n = !0, r = { value: 0 }) {
	let i = rl(t), a = {
		uIslandStyleTint: { value: new o.Vector3(...i.tint) },
		uIslandStyleSaturation: { value: i.saturation },
		uIslandStyleContrast: { value: i.contrast },
		uIslandStyleBrightness: { value: i.brightness },
		uIslandStyleStrength: { value: sl(i, e) },
		uIslandStyleVariant: { value: i.variant },
		uIslandStyleMacroAmount: { value: i.macroAmount },
		uIslandStyleShimmer: { value: i.shimmer },
		uIslandStyleTime: r
	}, s = t;
	return {
		enabled: n,
		role: e,
		uniforms: a,
		get style() {
			return s;
		},
		customProgramCacheKey: () => cl(e),
		onBeforeCompile(e) {
			if (!n) return;
			let t = e.fragmentShader.includes(Yc) || e.fragmentShader.includes(Qc) && e.fragmentShader.includes(Xc), r = e.vertexShader.includes(Yc) || e.vertexShader.includes(Qc) && e.vertexShader.includes(Zc);
			t && r && (Object.assign(e.uniforms, a), e.fragmentShader.includes(Yc) || (e.fragmentShader = e.fragmentShader.replace(Qc, `${Qc}\n${$c}`), e.fragmentShader = e.fragmentShader.replace(Xc, `${Xc}\n${el}`)), e.vertexShader.includes(Yc) || (e.vertexShader = e.vertexShader.replace(Qc, `${Qc}\n${tl}`), e.vertexShader = e.vertexShader.replace(Zc, `${nl}\n${Zc}`)));
		},
		setStyle(t) {
			if (t === s) return !1;
			let n = rl(t);
			return s = t, a.uIslandStyleTint.value.set(...n.tint), a.uIslandStyleSaturation.value = n.saturation, a.uIslandStyleContrast.value = n.contrast, a.uIslandStyleBrightness.value = n.brightness, a.uIslandStyleStrength.value = sl(n, e), a.uIslandStyleVariant.value = n.variant, a.uIslandStyleMacroAmount.value = n.macroAmount, a.uIslandStyleShimmer.value = n.shimmer, !0;
		}
	};
}
//#endregion
//#region src/island/course-spring-material.ts
var ul = "\nfloat springHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat springNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);\nreturn mix(mix(springHash(i),springHash(i+vec2(1.0,0.0)),f.x),mix(springHash(i+vec2(0.0,1.0)),springHash(i+vec2(1.0,1.0)),f.x),f.y);}\n";
function dl(e = "still", t = { uSpringFlowTime: { value: 0 } }) {
	return {
		uniforms: t,
		customProgramCacheKey: () => `course-spring-${e}-v2`,
		onBeforeCompile(n) {
			Object.assign(n.uniforms, t), n.vertexShader = n.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 springFlow;\nvarying vec2 vSpringFlow;\nvarying vec3 vSpringWorld;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvSpringFlow=springFlow;\nvSpringWorld=(modelMatrix*vec4(transformed,1.0)).xyz;"), n.fragmentShader = n.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec2 vSpringFlow;\nvarying vec3 vSpringWorld;\nuniform float uSpringFlowTime;\n${ul}`), n.fragmentShader = e === "still" ? n.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n          float springDepth=clamp(vSpringFlow.x,0.0,1.0);\n          float springT=uSpringFlowTime;\n          vec3 springShallow=vec3(0.44,0.80,0.78);\n          vec3 springDeep=vec3(0.07,0.38,0.60);\n          float springRun=step(0.0,vSpringFlow.y);\n          vec3 springColour=mix(springShallow,springDeep,smoothstep(0.0,0.9,springDepth));\n          float springStreak=springRun*smoothstep(0.62,0.95,springNoise(vec2(vSpringFlow.y*3.2-springT*2.6,vSpringWorld.x*2.1+vSpringWorld.z*2.1)));\n          // A foam line at the pond's bank; a stream's edges only brighten a little.\n          float springFoam=smoothstep(0.16,0.0,springDepth-0.035*sin(springT*1.4+vSpringWorld.x*3.0+vSpringWorld.z*2.0))*(1.0-springRun*0.7);\n          springColour=mix(springColour,vec3(0.93,0.98,0.97),max(springFoam*0.75,springStreak*0.45));\n          diffuseColor.rgb=springColour;\n        ").replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n          {\n            vec2 springP=vSpringWorld.xz;\n            float springS=uSpringFlowTime;\n            float springAlong=max(vSpringFlow.y,0.0);\n            float dx=cos(springP.x*2.7+springS*0.9)*0.5+cos((springP.x+springP.y)*4.3-springS*1.3)*0.35+cos(springAlong*6.0-springS*3.2)*0.3*step(0.0,vSpringFlow.y);\n            float dz=cos(springP.y*2.3-springS*0.8)*0.5+cos((springP.x-springP.y)*3.9+springS*1.1)*0.35;\n            vec3 springTilt=(viewMatrix*vec4(dx,0.0,dz,0.0)).xyz;\n            normal=normalize(normal+springTilt*0.16);\n          }\n        ").replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n          roughnessFactor=mix(roughnessFactor,0.7,springFoam);\n        ") : n.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n          float springLayer=step(2.0,vSpringFlow.x);\n          float springAcross=vSpringFlow.x-springLayer*4.0;\n          float springDrop=clamp(vSpringFlow.y,0.0,1.0);\n          float springT=uSpringFlowTime;\n          float springN=springNoise(vec2(springAcross*4.0+springLayer*7.3,springDrop*5.0-springT*1.8))*0.65\n            +springNoise(vec2(springAcross*9.0+springLayer*3.1,springDrop*13.0-springT*3.1))*0.35;\n          float springStreak=smoothstep(0.56,0.8,springN);\n          // Cyan where it leaves the lip, a saturated blue body, white streaks.\n          vec3 springColour=mix(vec3(0.5,0.86,0.94),vec3(0.12,0.5,0.84),smoothstep(0.0,0.4,springDrop));\n          float springLip=smoothstep(0.1,0.0,springDrop);\n          float springAir=smoothstep(0.55,1.0,springDrop);\n          springColour=mix(springColour,vec3(0.97,1.0,1.0),max(springStreak*0.8,springLip*0.9));\n          springColour=mix(springColour,vec3(0.9,0.96,1.0),springAir*0.45);\n          float springEdge=1.0-smoothstep(0.55,1.0,abs(springAcross));\n          float springFade=1.0-smoothstep(0.62,1.0,springDrop);\n          diffuseColor.rgb=springColour;\n          diffuseColor.a*=clamp((0.72+springStreak*0.25)*springEdge*springFade*(1.0-springLayer*0.35),0.0,1.0);\n        ").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n          totalEmissiveRadiance+=diffuseColor.rgb*0.18;\n        ");
		}
	};
}
//#endregion
//#region src/island/course-spring-geometry.ts
var fl = () => ({
	positions: [],
	colors: [],
	indices: [],
	flow: []
});
function $(e, t, n, r, i, a = 0, o = -1) {
	let s = e.positions.length / 3;
	return e.positions.push(t, n, r), e.colors.push(i.r, i.g, i.b), e.flow.push(a, o), s;
}
function pl(e, t) {
	let n = new o.BufferGeometry();
	return n.setAttribute("position", new o.Float32BufferAttribute(e.positions, 3)), n.setAttribute("color", new o.Float32BufferAttribute(e.colors, 3)), n.setIndex(e.indices), t && n.setAttribute(t, new o.Float32BufferAttribute(e.flow, 2)), n.computeVertexNormals(), n.computeBoundingBox(), n.computeBoundingSphere(), n;
}
var ml = new o.Color(3844036), hl = new o.Color(5916214), gl = new o.Color(8216903), _l = new o.Color(6266686), vl = new o.Color(8174668), yl = new o.Color(5209909), bl = new o.Color(16168911), xl = new o.Color(8038467);
function Sl(e, t, n, r) {
	let i = (t) => new o.Vector3(e.positions[t * 3], e.positions[t * 3 + 1], e.positions[t * 3 + 2]);
	i(n).sub(i(t)).cross(i(r).sub(i(t))).y >= 0 ? e.indices.push(t, n, r) : e.indices.push(t, r, n);
}
function Cl(e, t) {
	let n = e.channel[t], r = L(`${e.id}/stream`) * 6.28;
	return n.halfWidth * (.86 + .14 * Math.sin(t * .9 + r) * Math.sin(t * .37 + r));
}
function wl(e, t) {
	let n = L(e.id) * Math.PI * 2;
	return e.basin.radius * (.9 + .07 * Math.sin(t * 3 + n) + .05 * Math.sin(t * 5 - n * 1.7));
}
function Tl(e, t, n) {
	let { basin: r } = t, i = [
		{
			r: 1,
			y: r.y + .004,
			c: hl
		},
		{
			r: 1.04,
			y: r.y + .03,
			c: gl
		},
		{
			r: 1.1,
			y: r.groundRange[0] - .08,
			c: xl
		}
	], a = e.positions.length / 3;
	for (let a = 0; a <= n; a += 1) {
		let o = a * Math.PI * 2 / n, s = wl(t, o);
		for (let t of i) $(e, r.x + Math.cos(o) * s * t.r, t.y, r.z + Math.sin(o) * s * t.r, t.c);
	}
	for (let t = 0; t < n; t += 1) for (let n = 0; n < i.length - 1; n += 1) {
		let r = a + t * i.length + n, o = r + i.length;
		Sl(e, r, o, r + 1), Sl(e, r + 1, o, o + 1);
	}
}
function El(e, t) {
	let { direction: n, channel: r } = t, i = null;
	for (let [a, o] of r.entries()) {
		let r = {
			...o,
			halfWidth: Cl(t, a)
		}, s = [];
		for (let t of [-1, 1]) {
			let i = (e) => ({
				x: r.x - n.z * e * t,
				z: r.z + n.x * e * t
			}), a = i(r.halfWidth * .98), o = i(r.halfWidth + .06), c = i(r.halfWidth + .16);
			s.push($(e, a.x, r.y + .004, a.z, hl), $(e, o.x, r.y + .03, o.z, gl), $(e, c.x, r.groundRange[0] - .08, c.z, xl));
		}
		if (i) for (let t of [0, 3]) for (let n = 0; n < 2; n += 1) {
			let r = i[t + n], a = s[t + n], o = i[t + n + 1], c = s[t + n + 1];
			Sl(e, r, o, a), Sl(e, o, c, a);
		}
		i = s;
	}
}
function Dl(e, t) {
	let { basin: n } = t, r = 3 + Math.floor(L(`${t.id}/lily`) * 3);
	for (let i = 0; i < r; i += 1) {
		let r = `${t.id}/lily/${i}`, a = L(`${r}/a`) * Math.PI * 2, o = n.radius * (.35 + L(`${r}/d`) * .4), s = n.x + Math.cos(a) * o, c = n.z + Math.sin(a) * o, l = n.radius * (.11 + L(`${r}/r`) * .06), u = L(`${r}/t`) * Math.PI * 2, d = _l.clone().lerp(vl, L(`${r}/c`)), f = $(e, s, n.y + .012, c, d), p = Array.from({ length: 9 }, (t, r) => {
			let i = u + .5 + r / 8 * (Math.PI * 2 - .5);
			return $(e, s + Math.cos(i) * l, n.y + .012, c + Math.sin(i) * l, d);
		});
		for (let t = 0; t < 8; t += 1) Sl(e, f, p[t + 1], p[t]);
		if (i === 0) {
			let t = l * .45, r = $(e, s, n.y + .012 + t, c, bl), i = [
				0,
				1,
				2
			].map((r) => {
				let i = u + r / 3 * Math.PI * 2;
				return $(e, s + Math.cos(i) * t * .7, n.y + .02, c + Math.sin(i) * t * .7, bl);
			});
			for (let t = 0; t < 3; t += 1) Sl(e, r, i[t], i[(t + 1) % 3]);
		}
	}
}
function Ol(e, t) {
	let { basin: n, direction: r } = t, i = Math.atan2(-r.z, -r.x);
	for (let r = 0; r < 3; r += 1) {
		let a = `${t.id}/reed/${r}`, o = i + (r - 1) * .7 + (L(`${a}/a`) - .5) * .3, s = wl(t, o) * 1.02, c = n.x + Math.cos(o) * s, l = n.z + Math.sin(o) * s;
		for (let t = 0; t < 4; t += 1) {
			let r = L(`${a}/${t}/t`) * Math.PI * 2, i = .08 + L(`${a}/${t}/l`) * .1, o = .45 + L(`${a}/${t}/h`) * .35, s = c + Math.cos(r) * .06, u = l + Math.sin(r) * .06, d = .035, f = $(e, s - Math.sin(r) * d, n.y, u + Math.cos(r) * d, yl), p = $(e, s + Math.sin(r) * d, n.y, u - Math.cos(r) * d, yl), m = $(e, s + Math.cos(r) * i, n.y + o, u + Math.sin(r) * i, yl.clone().multiplyScalar(1.2));
			e.indices.push(f, p, m, p, f, m);
		}
	}
}
function kl(e) {
	let { basin: t, direction: n, channel: r } = e, i = Math.atan2(n.z, n.x), a = [], o = [], s = [
		"rock_smallE",
		"rock_smallF",
		"rock_smallI",
		"rock_smallH"
	];
	for (let n = 0; n < 4; n += 1) {
		let r = `${e.id}/pebble/${n}`, o = i + .9 + n * 1.2 + (L(`${r}/a`) - .5) * .4, c = wl(e, o) * 1.12;
		a.push({
			shape: s[n],
			x: t.x + Math.cos(o) * c,
			z: t.z + Math.sin(o) * c,
			scale: .9 + L(`${r}/s`) * .6,
			turn: L(`${r}/t`) * 6.28,
			turf: n % 2 == 0
		});
	}
	let c = r.at(-1);
	for (let t of [-1, 1]) {
		let r = c.halfWidth + .34;
		o.push({
			shape: t < 0 ? "rock_tallC" : "rock_tallG",
			x: c.x - n.z * r * t - n.x * .1,
			z: c.z + n.x * r * t - n.z * .1,
			scale: 1.05 + L(`${e.id}/flank/${t}`) * .25,
			turn: L(`${e.id}/flank/${t}/t`) * 6.28,
			turf: !0
		});
	}
	return {
		pond: a,
		notch: o
	};
}
function Al(e, t) {
	let n = e.channel.at(-1), r = 1.25 * (1 - (1 - Math.min(1, t / .22)) ** 3);
	return new o.Vector3(e.lip.x + e.direction.x * r, n.y - .03 - e.drop * t ** 1.55, e.lip.z + e.direction.z * r);
}
function jl(e, t) {
	let { direction: n, channel: r } = t, i = r.at(-1), a = [
		-1,
		-.6,
		-.2,
		.2,
		.6,
		1
	], s = new o.Color(16777215);
	for (let r of [0, 1]) {
		let o = i.halfWidth * (r === 0 ? 1.3 : .9), c = r === 0 ? 0 : .1, l = null;
		for (let i = 0; i <= 16; i += 1) {
			let u = i / 16, d = Al(t, u), f = o * (1 + 1.1 * u ** 1.2), p = a.map((t) => $(e, d.x - n.z * f * t + n.x * c, d.y + (r === 1 ? .02 : 0), d.z + n.x * f * t + n.z * c, s, t + r * 4, u));
			if (l) for (let t = 0; t < a.length - 1; t += 1) e.indices.push(l[t], p[t], l[t + 1], l[t + 1], p[t], p[t + 1]);
			l = p;
		}
	}
}
function Ml(e) {
	let t = fl(), n = fl(), r = fl(), { basin: i, direction: a, channel: o, lip: s } = e, c = $(t, i.x, i.y, i.z, ml, 1, -1), l = [
		{
			k: .45,
			depth: .8
		},
		{
			k: .8,
			depth: .35
		},
		{
			k: 1,
			depth: 0
		}
	], u = l.map(() => []);
	for (let n = 0; n <= 28; n += 1) {
		let r = n * Math.PI * 2 / 28, a = wl(e, r);
		l.forEach((e, n) => u[n].push($(t, i.x + Math.cos(r) * a * e.k, i.y, i.z + Math.sin(r) * a * e.k, ml, e.depth, -1)));
	}
	for (let e = 1; e <= 28; e += 1) {
		t.indices.push(c, u[0][e], u[0][e - 1]);
		for (let n = 1; n < l.length; n += 1) t.indices.push(u[n - 1][e - 1], u[n - 1][e], u[n][e - 1], u[n][e - 1], u[n - 1][e], u[n][e]);
	}
	let d = [
		-1,
		-.5,
		0,
		.5,
		1
	], f = null, p = 0;
	o.forEach((n, r) => {
		r > 0 && (p += Math.hypot(n.x - o[r - 1].x, n.z - o[r - 1].z));
		let i = Cl(e, r), s = d.map((e) => $(t, n.x - a.z * i * e, n.y, n.z + a.x * i * e, ml, 1 - Math.abs(e), p));
		if (f) for (let e = 0; e < d.length - 1; e += 1) t.indices.push(f[e], f[e + 1], s[e], f[e + 1], s[e + 1], s[e]);
		f = s;
	});
	let m = p + Math.hypot(s.x - o.at(-1).x, s.z - o.at(-1).z), h = d.map((e) => $(t, s.x - a.z * o.at(-1).halfWidth * e, o.at(-1).y - .03, s.z + a.x * o.at(-1).halfWidth * e, ml, 1 - Math.abs(e), m));
	if (f) for (let e = 0; e < d.length - 1; e += 1) t.indices.push(f[e], f[e + 1], h[e], f[e + 1], h[e + 1], h[e]);
	jl(n, e), Tl(r, e, 28), El(r, e), Dl(r, e), Ol(r, e);
	let g = kl(e), _ = [Da(g.pond).translate(0, i.groundRange[0], 0), Da(g.notch).translate(0, o.at(-1).groundRange[0], 0)], v = pl(r, null);
	if ((t.indices.length + n.indices.length + r.indices.length) / 3 + _.reduce((e, t) => e + t.getIndex().count / 3, 0) > 1600) throw Error("Spring exceeded its fixed geometric ceiling");
	return {
		water: pl(t, "springFlow"),
		fall: pl(n, "springFlow"),
		bank: v,
		stones: _
	};
}
function Nl(e) {
	let t = [], n = e.channel.at(-1), { direction: r } = e;
	for (let i = 0; i < 6; i += 1) {
		let a = `${e.id}/mist/${i}`, o = Al(e, .84 + L(`${a}/s`) * .16), s = ((i + .5) / 6 - .5) * n.halfWidth * 5 + (L(`${a}/a`) - .5) * .4, c = .3 + L(`${a}/o`) * 1.1;
		t.push(o.x - r.z * s + r.x * c, o.y + (L(`${a}/y`) - .5) * .8, o.z + r.x * s + r.z * c);
	}
	return Float32Array.from(t);
}
var Pl = null;
function Fl() {
	if (Pl) return Pl;
	let e = /* @__PURE__ */ new Uint8Array(4096);
	for (let t = 0; t < 32; t += 1) for (let n = 0; n < 32; n += 1) {
		let r = Math.hypot(n + .5 - 16, t + .5 - 16) / 16, i = Math.max(0, 1 - r) ** 1.8, a = (t * 32 + n) * 4;
		e[a] = e[a + 1] = e[a + 2] = 255, e[a + 3] = Math.round(i * 255);
	}
	return Pl = new o.DataTexture(e, 32, 32, o.RGBAFormat), Pl.needsUpdate = !0, Pl;
}
var Il = 12167810, Ll = /* @__PURE__ */ new WeakMap();
function Rl(e, t = 256) {
	if (!Number.isInteger(t) || t < 4 || t > 512) throw RangeError("Invalid course texture size");
	let n = br(e), r = e.themeSelection.recipeId && eo(e.themeSelection.recipeId) ? Vs(e, "course") : null, i = new Float32Array(t * t), a = new Float32Array(t * t), o = n.extent, s = o * 2 / t, c = (e, n, r, i, a) => {
		let c = (n + o) / s - .5, l = (r + o) / s - .5, u = i / s;
		for (let n = Math.max(0, Math.floor(l - u)); n <= Math.min(t - 1, Math.ceil(l + u)); n++) for (let r = Math.max(0, Math.floor(c - u)); r <= Math.min(t - 1, Math.ceil(c + u)); r++) {
			let i = Math.hypot(r - c, n - l) / u;
			if (i >= 1) continue;
			let o = 1 - i * i * (3 - 2 * i), s = n * t + r;
			e[s] = Math.max(e[s], o * a);
		}
	};
	for (let e of r?.placements ?? []) e.kind === "tree" ? c(i, e.x, e.z, e.height * .8 + 1.4, 1) : e.kind === "bush" && e.height > .6 ? c(i, e.x, e.z, e.height + .7, .4) : (e.kind === "landmark" || e.kind === "prop") && c(a, e.x, e.z, X(e) + 1.5, .7);
	for (let e of r?.landscape?.outcrops ?? []) c(i, e.x, e.z, e.radius + 1.2, .58);
	let l = new Uint8Array(t * t * 4), u = (e) => Math.max(0, Math.min(1, e));
	for (let e = 0; e < t; e++) for (let r = 0; r < t; r++) {
		let c = e * t + r, d = G(n, (r + .5) * s - o, (e + .5) * s - o), f = i[c] * (1 - d.route), p = a[c] * (1 - f * .55), m = d.grass * (1 - d.route), h = +!!d.inside;
		l[c * 4] = Math.round(u(f * h) * 255), l[c * 4 + 1] = Math.round(u(m * h) * 255), l[c * 4 + 2] = Math.round(u(d.route) * 255), l[c * 4 + 3] = Math.round(u(p * h) * 255);
	}
	return {
		data: l,
		extent: o
	};
}
function zl(e) {
	let t = Ll.get(e);
	if (!t) {
		let { data: n } = Rl(e), r = new o.DataTexture(n, 256, 256, o.RGBAFormat);
		r.name = "course-canopy-meadow-route-wear-masks", r.colorSpace = o.NoColorSpace, r.magFilter = o.LinearFilter, r.minFilter = o.LinearMipmapLinearFilter, r.generateMipmaps = !0, r.needsUpdate = !0, t = {
			texture: r,
			owners: 0
		}, Ll.set(e, t);
	}
	let n = t;
	n.owners++;
	let r = !1;
	return {
		texture: n.texture,
		extent: br(e).extent,
		dispose() {
			r || (r = !0, --n.owners === 0 && (n.texture.dispose(), Ll.get(e) === n && Ll.delete(e)));
		}
	};
}
//#endregion
//#region src/island/surface-wear.ts
var Bl = [
	{
		cells: 4,
		gain: .22
	},
	{
		cells: 7,
		gain: .065
	},
	{
		cells: 13,
		gain: .018
	}
].map(({ cells: e, gain: t }) => ({
	cells: e,
	gain: t,
	values: Array.from({ length: e * e }, (t, n) => {
		let r = Math.imul(n + 1, 374761393) ^ Math.imul(e, 668265263);
		return r = Math.imul(r ^ r >>> 13, 1274126177), ((r ^ r >>> 16) >>> 0) / 4294967295 * 2 - 1;
	})
})), Vl = (e) => e * e * e * (e * (e * 6 - 15) + 10);
function Hl(e, t) {
	let n = e - Math.floor(e), r = t - Math.floor(t), i = .5;
	for (let { cells: e, gain: t, values: a } of Bl) {
		let o = n * e, s = r * e, c = Math.floor(o), l = Math.floor(s), u = Vl(o - c), d = Vl(s - l), f = a[l * e + c], p = a[l * e + (c + 1) % e], m = a[(l + 1) % e * e + c], h = a[(l + 1) % e * e + (c + 1) % e];
		i += (f + (p - f) * u + (m - f + (h - m - p + f) * u) * d) * t;
	}
	return i;
}
//#endregion
//#region src/island/surface-turf.ts
var Ul = 8, Wl = (e) => {
	let t = Math.imul(e + 71, 374761393);
	return t = Math.imul(t ^ t >>> 13, 1274126177), ((t ^ t >>> 16) >>> 0) / 4294967295;
}, Gl = Array.from({ length: 64 }, (e, t) => {
	let n = Wl(t * 7) * Math.PI;
	return {
		x: .2 + Wl(t * 7 + 1) * .6,
		y: .2 + Wl(t * 7 + 2) * .6,
		cos: Math.cos(n),
		sin: Math.sin(n),
		length: .35 + Wl(t * 7 + 3) * .2,
		width: .075 + Wl(t * 7 + 4) * .045
	};
});
function Kl(e, t) {
	let n = (e - Math.floor(e)) * Ul, r = (t - Math.floor(t)) * Ul, i = Math.floor(n), a = Math.floor(r), o = 0;
	for (let e = -1; e <= 1; e++) for (let t = -1; t <= 1; t++) {
		let s = i + t, c = a + e, l = Gl[(c + Ul) % Ul * Ul + (s + Ul) % Ul], u = n - s - l.x, d = r - c - l.y, f = u * l.cos + d * l.sin, p = -u * l.sin + d * l.cos;
		for (let e = -1; e <= 1; e++) {
			let t = l.length * (e === 0 ? 1 : .78), n = (p + t * .5) / t;
			if (n <= 0 || n >= 1) continue;
			let r = l.width * (1 - n * .72), i = Math.abs(f - e * (.06 + n * .07)) / r;
			if (i >= 1) continue;
			let a = 1 - i * i * (3 - 2 * i);
			o = Math.max(o, a * Math.sin(n * Math.PI));
		}
	}
	return .12 + o * .76;
}
var ql = "university-surface-swatch-v5";
function Jl(e = 128) {
	if (!Number.isInteger(e) || e < 4 || e > 512) throw RangeError("Invalid surface swatch size");
	let t = new Uint8Array(e * e * 4);
	for (let n = 0; n < e; n++) for (let r = 0; r < e; r++) {
		let i = Hl((r + .5) / e, (n + .5) / e), a = (n * e + r) * 4;
		t[a] = Math.round(i * 255), t[a + 1] = Math.round((.96 - i * .12) * 255), t[a + 2] = Math.round((.76 + i * .24) * 255), t[a + 3] = Math.round(Kl((r + .5) / e, (n + .5) / e) * 255);
	}
	return t;
}
var Yl = null;
function Xl() {
	if (!Yl) {
		let e = new o.DataTexture(Jl(), 128, 128, o.RGBAFormat);
		e.name = "stylized-worn-surface-height-roughness-tone", e.colorSpace = o.NoColorSpace, e.wrapS = e.wrapT = o.RepeatWrapping, e.magFilter = o.LinearFilter, e.minFilter = o.LinearMipmapLinearFilter, e.generateMipmaps = !0, e.needsUpdate = !0, Yl = {
			texture: e,
			owners: 0
		};
	}
	let e = Yl;
	e.owners++;
	let t = !1;
	return {
		texture: e.texture,
		dispose() {
			t || (t = !0, --e.owners === 0 && (e.texture.dispose(), Yl === e && (Yl = null)));
		}
	};
}
function Zl(e, t = 1) {
	if (!Number.isFinite(t) || t <= 0) throw RangeError("Invalid surface coordinate scale");
	if (e.hasAttribute("surfaceCoordinate")) return;
	let n = e.getAttribute("position").clone();
	if (t !== 1) for (let e = 0; e < n.count; e++) n.setXYZ(e, n.getX(e) / t, n.getY(e) / t, n.getZ(e) / t);
	e.setAttribute("surfaceCoordinate", n);
}
var Ql = "\nuniform sampler2D uSurfaceSwatch;\nuniform float uSurfaceDetailMode;\nuniform float uSurfaceToneStrength;\nuniform float uSurfaceReliefStrength;\nuniform float uSurfaceMatteStrength;\nuniform float uSurfaceTextureScale;\nvarying vec3 vSurfaceCoordinate;\nvarying float vSurfaceUp;\n";
function $l(e, t) {
	let n = null, r = null, i = {
		uSurfaceSwatch: { value: null },
		uSurfaceDetailMode: { value: 2 },
		uSurfaceToneStrength: { value: e === "stone" ? .32 : .24 },
		uSurfaceReliefStrength: { value: e === "stone" ? .025 : .008 },
		uSurfaceMatteStrength: { value: e === "stone" ? .5 : .84 },
		uSurfaceTextureScale: { value: .075 },
		...t ? {
			uCourseSurface: { value: null },
			uCourseSurfaceExtent: { value: 1 },
			uCourseCourtyardColour: { value: new o.Color(Il) },
			uMeadowStrength: { value: 1 },
			uMeadowTextureScale: { value: .14 }
		} : {}
	}, a = () => {
		n ??= Xl(), i.uSurfaceSwatch.value = n.texture, t && i.uCourseSurface && i.uCourseSurfaceExtent && (r ??= zl(t), i.uCourseSurface.value = r.texture, i.uCourseSurfaceExtent.value = r.extent);
	};
	return {
		uniforms: i,
		activate: a,
		materialKey: o.MathUtils.generateUUID(),
		info: {
			role: e,
			textureSize: 128,
			baseBytes: 128 ** 2 * 4,
			mipBytesApproximate: Math.ceil(128 ** 2 * 4 * 4 / 3),
			shared: !0,
			gardenMaskBytes: t ? 262144 : 0,
			source: "University authored periodic scalar swatch; no external media"
		},
		customProgramCacheKey: () => `${ql}/${t ? "garden" : "swatch"}`,
		onBeforeCompile(e) {
			let t = "#include <begin_vertex>", n = "#include <color_fragment>", o = "#include <roughnessmap_fragment>", s = "#include <normal_fragment_maps>";
			if (!e.vertexShader.includes(t) || ![
				n,
				o,
				s
			].every((t) => e.fragmentShader.includes(t))) throw Error("Surface swatch requires the supported Three StandardMaterial chunks");
			a(), Object.assign(e.uniforms, i), e.vertexShader = e.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 surfaceCoordinate;\nvarying vec3 vSurfaceCoordinate;\nvarying float vSurfaceUp;").replace(t, `${t}\nvSurfaceCoordinate = surfaceCoordinate;\nvSurfaceUp = normal.y;`), e.fragmentShader = e.fragmentShader.replace("#include <common>", `#include <common>\n${Ql}\n${r ? "uniform sampler2D uCourseSurface;\nuniform float uCourseSurfaceExtent;\nuniform vec3 uCourseCourtyardColour;\nuniform float uMeadowStrength;\nuniform float uMeadowTextureScale;" : ""}`).replace(n, `${n}
          // Continuous oblique projection: no atlas seams or per-face switches.
          // Model-locked coordinates do not follow the camera or world matrix.
          vec2 surfaceUV = (vSurfaceCoordinate.xz + vSurfaceCoordinate.y * vec2(0.37, 0.71)) * uSurfaceTextureScale;
          vec3 surfaceSample = texture2D(uSurfaceSwatch, surfaceUV).rgb;
          float surfaceEnabled = step(0.5, uSurfaceDetailMode);
          float surfacePhysical = step(1.5, uSurfaceDetailMode);
          float surfaceWear = surfaceSample.r;
          vec3 surfaceTone = mix(vec3(0.93, 0.96, 1.02), vec3(1.05, 1.02, 0.95), surfaceWear);
          surfaceTone *= 1.0 + (surfaceSample.b - 0.88) * 1.6;
          ${r ? "\n          vec4 gardenSurface = texture2D(uCourseSurface, vSurfaceCoordinate.xz / (uCourseSurfaceExtent * 2.0) + 0.5);\n          float gardenFace = smoothstep(0.35, 0.85, vSurfaceUp);\n          float gardenLush = gardenSurface.r;\n          vec3 gardenPigment = clamp(vec3(\n            0.99 - gardenLush * 0.24 - gardenSurface.g * 0.018 + gardenSurface.a * 0.035,\n            1.0 - gardenLush * 0.075 - gardenSurface.a * 0.07,\n            0.97 - gardenLush * 0.25 - gardenSurface.a * 0.18), 0.0, 1.0);\n          diffuseColor.rgb *= mix(vec3(1.0), gardenPigment, surfaceEnabled * gardenFace);\n          diffuseColor.rgb = mix(diffuseColor.rgb, uCourseCourtyardColour,\n            surfaceEnabled * gardenFace * gardenSurface.a * (1.0 - gardenSurface.b) * 0.82);\n          // The actual field, not canopy paint, owns open turf. Use the spare\n          // swatch channel at two material scales; both fade before subpixels.\n          float gardenTurf = smoothstep(0.72, 0.94, vSurfaceUp) *\n            smoothstep(0.03, 0.24, gardenSurface.g) * (1.0 - gardenSurface.b) * (1.0 - gardenSurface.a);\n          vec2 turfUV = vSurfaceCoordinate.xz * uMeadowTextureScale;\n          float turfFootprint = max(length(dFdx(turfUV)), length(dFdy(turfUV))) * 8.0;\n          float turfFade = 1.0 - smoothstep(0.10, 0.38, turfFootprint);\n          float turfFine = texture2D(uSurfaceSwatch, turfUV).a;\n          float turfSecond = texture2D(uSurfaceSwatch, mat2(0.6, 0.8, -0.8, 0.6) * turfUV * 1.73 + vec2(0.31, 0.57)).a;\n          float turfSecondFade = 1.0 - smoothstep(0.10, 0.38, turfFootprint * 1.73);\n          float turfGrain = (turfFine - 0.16) * turfFade * 0.7 +\n            (turfSecond - 0.16) * turfSecondFade * 0.3;\n          vec3 turfPigment = mix(vec3(0.91, 0.97, 0.81), vec3(1.05, 1.035, 0.97),\n            clamp(0.5 + (surfaceWear - 0.5) * 2.4, 0.0, 1.0));\n          turfPigment *= 1.0 + turfGrain * 0.48;\n          diffuseColor.rgb *= mix(vec3(1.0), turfPigment,\n            surfaceEnabled * uMeadowStrength * gardenTurf);\n          " : ""}
          // The long-course colour-only witness exposed repeated albedo
          // waves, even with all relief disabled. Keep fine pigment at real
          // forest edges, not over every clearing or vertical root face.
          diffuseColor.rgb *= mix(vec3(1.0), surfaceTone,
            surfaceEnabled * uSurfaceToneStrength ${r ? "* gardenFace * gardenLush" : ""});
        `).replace(o, `${o}
          roughnessFactor = mix(roughnessFactor, surfaceSample.g,
            surfacePhysical * uSurfaceMatteStrength);
          ${r ? "roughnessFactor = mix(roughnessFactor, 0.96,\n            surfacePhysical * gardenFace * (0.35 + gardenLush * 0.65) * 0.65);\n          roughnessFactor = mix(roughnessFactor, 0.96 - clamp(turfGrain, 0.0, 0.6) * 0.08,\n            surfacePhysical * uMeadowStrength * gardenTurf);" : ""}
        `).replace(s, `${s}
          // Screen derivatives of the SAME shallow relief cause. Mips and a
          // footprint fade suppress subpixel normals; nothing moves a vertex.
          float surfaceFootprint = max(length(dFdx(surfaceUV)), length(dFdy(surfaceUV)));
          float surfaceRelief = surfaceWear * uSurfaceReliefStrength * surfacePhysical
            ${r ? "* gardenFace * gardenLush" : ""}
            * (1.0 - smoothstep(0.035, 0.14, surfaceFootprint));
          vec3 surfaceDx = dFdx(-vViewPosition);
          vec3 surfaceDy = dFdy(-vViewPosition);
          vec3 surfaceRx = cross(surfaceDy, normal);
          vec3 surfaceRy = cross(normal, surfaceDx);
          float surfaceDet = dot(surfaceDx, surfaceRx);
          vec3 surfaceGradient = sign(surfaceDet) *
            (dFdx(surfaceRelief) * surfaceRx + dFdy(surfaceRelief) * surfaceRy);
          if (abs(surfaceDet) > 1e-10 && surfacePhysical > 0.5) {
            normal = normalize(abs(surfaceDet) * normal - surfaceGradient);
          }
        `);
		},
		dispose() {
			n?.dispose(), r?.dispose(), n = null, r = null, i.uSurfaceSwatch.value = null, i.uCourseSurface && (i.uCourseSurface.value = null);
		}
	};
}
//#endregion
//#region src/island/craft-material.ts
function eu() {
	let e = null, t = {
		uSurfaceSwatch: { value: null },
		uSurfaceDetailMode: { value: 2 }
	}, n = () => {
		e ??= Xl(), t.uSurfaceSwatch.value = e.texture;
	};
	return {
		uniforms: t,
		activate: n,
		info: {
			role: "crafted-facilities",
			textureSize: 128,
			shared: !0,
			incrementalTextureBytes: 0,
			coordinateBytesPerVertex: 12,
			source: "University authored material roles and filtered craft marks; shared scalar swatch"
		},
		customProgramCacheKey: () => "university-crafted-scenery-v1",
		onBeforeCompile(e) {
			for (let t of ["color_fragment", "roughnessmap_fragment"]) if (!e.fragmentShader.includes(`#include <${t}>`)) throw Error("Crafted scenery needs the supported StandardMaterial chunks");
			n(), Object.assign(e.uniforms, t), e.vertexShader = e.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 craftSurface;\nvarying vec3 vCraftSurface;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvCraftSurface = craftSurface;"), e.fragmentShader = e.fragmentShader.replace("#include <common>", "#include <common>\n          varying vec3 vCraftSurface;\n          uniform sampler2D uSurfaceSwatch;\n          uniform float uSurfaceDetailMode;\n        ").replace("#include <color_fragment>", "#include <color_fragment>\n          float craftTimber = 1.0 - step(0.25, abs(vCraftSurface.z - 1.0));\n          float craftRoof = 1.0 - step(0.25, abs(vCraftSurface.z - 2.0));\n          float craftPlaster = 1.0 - step(0.25, abs(vCraftSurface.z - 3.0));\n          float craftCloth = 1.0 - step(0.25, abs(vCraftSurface.z - 4.0));\n          float craftGlass = 1.0 - step(0.25, abs(vCraftSurface.z - 5.0));\n          float craftEnabled = step(0.5, uSurfaceDetailMode);\n          float craftPhysical = step(1.5, uSurfaceDetailMode);\n          vec3 craftWear = vec3(0.5, 0.9, 0.88);\n          if (vCraftSurface.z > 0.5) {\n            craftWear = texture2D(uSurfaceSwatch, vCraftSurface.xy * 1.35).rgb;\n          }\n          float craftGrainAxis = vCraftSurface.x * 32.0 + craftWear.r * 1.2;\n          float craftGrain = sin(craftGrainAxis) *\n            (1.0 - smoothstep(0.4, 1.5, fwidth(craftGrainAxis)));\n          // The roof's ridges are filtered pigment, not subpixel geometry.\n          // They disappear before minification can turn them into dotted edges.\n          float craftSeamAxis = vCraftSurface.x * 3.0;\n          float craftAA = max(fwidth(craftSeamAxis), 0.0001);\n          float craftSeam = (1.0 - smoothstep(0.012 - craftAA, 0.035 + craftAA,\n            abs(fract(craftSeamAxis + 0.5) - 0.5))) *\n            (1.0 - smoothstep(0.055, 0.15, craftAA));\n          float craftTone = (craftWear.b - 0.88) *\n            (craftTimber * 0.32 + craftRoof * 0.3 + craftPlaster * 0.12 + craftCloth * 0.12)\n            + craftGrain * craftTimber * 0.025 + craftSeam * craftRoof * 0.1;\n          diffuseColor.rgb *= 1.0 + craftEnabled * craftTone;\n        ").replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n          float craftTarget = roughnessFactor;\n          craftTarget = mix(craftTarget, clamp(craftWear.g - 0.08, 0.78, 0.94), craftTimber);\n          craftTarget = mix(craftTarget, clamp(craftWear.g - 0.19 - craftSeam * 0.03, 0.65, 0.82), craftRoof);\n          craftTarget = mix(craftTarget, 0.98, craftPlaster + craftCloth);\n          craftTarget = mix(craftTarget, 0.44, craftGlass);\n          roughnessFactor = mix(roughnessFactor, craftTarget, craftPhysical);\n        ");
		},
		dispose() {
			e?.dispose(), e = null, t.uSurfaceSwatch.value = null;
		}
	};
}
Aa.ruinTriangles;
function tu(e) {
	let t = [], n = [], r = [], i = new o.Color(11188158), a = new o.Color(13223607), s = new o.Color(9549402), c = e.radius, l = e.groundRange[1] + e.height - e.baseY, u = Math.cos(e.turn), d = Math.sin(e.turn), f = (i, a, o, s) => {
		let f = t.length / 3;
		for (let [r, f, p] of [
			i,
			a,
			o
		]) t.push(e.x + (r * u - p * d) * c, e.baseY + f * l, e.z + (r * d + p * u) * c), n.push(s.r, s.g, s.b);
		r.push(f, f + 1, f + 2);
	}, p = (e, t, n, r, o, c, l, u = !1) => {
		let d = i.clone().lerp(a, l), p = [
			[1, 1],
			[-1, 1],
			[-1, -1],
			[1, -1]
		], m = [
			{
				y: t,
				inset: .86
			},
			{
				y: t + o * .09,
				inset: 1
			},
			{
				y: t + o * .91,
				inset: 1
			},
			{
				y: t + o,
				inset: .86
			}
		].map((t) => p.map(([i, a]) => [
			e + i * r * t.inset / 2,
			t.y,
			n + a * c * t.inset / 2
		]));
		for (let e = 0; e < 3; e++) for (let t = 0; t < 4; t++) {
			let n = (t + 1) % 4;
			f(m[e][t], m[e + 1][t], m[e + 1][n], d), f(m[e][t], m[e + 1][n], m[e][n], d);
		}
		for (let r = 0; r < 4; r++) {
			let i = (r + 1) % 4;
			f([
				e,
				t + o,
				n
			], m[3][i], m[3][r], u ? s : d), f([
				e,
				t,
				n
			], m[0][r], m[0][i], d);
		}
	};
	for (let e of [-1, 1]) for (let t = 0; t < 3; t++) p(e * (.492 + t % 2 * .008), t * .17, 0, .245 - t * .012, .174, .27 - t * .012, .22 + t * .13 + (e + 1) * .08, t === 0);
	for (let e = 0; e < 7; e++) {
		let t = e * Math.PI / 7, n = (e + 1) * Math.PI / 7, r = [
			[
				Math.cos(t) * .615,
				.51 + Math.sin(t) * .45,
				.124
			],
			[
				Math.cos(n) * .615,
				.51 + Math.sin(n) * .45,
				.124
			],
			[
				Math.cos(n) * .37,
				.51 + Math.sin(n) * .27,
				.124
			],
			[
				Math.cos(t) * .37,
				.51 + Math.sin(t) * .27,
				.124
			]
		];
		r.push(...r.map(([e, t]) => [
			e,
			t,
			-.124
		]));
		let o = i.clone().lerp(a, .22 + e % 3 * .16);
		for (let [e, t, n] of [
			[
				0,
				1,
				2
			],
			[
				0,
				2,
				3
			],
			[
				4,
				6,
				5
			],
			[
				4,
				7,
				6
			]
		]) f(r[e], r[t], r[n], o);
		for (let t = 0; t < 4; t++) {
			if (t === 1 && e < 6 || t === 3 && e > 0) continue;
			let n = (t + 1) % 4;
			f(r[t], r[t + 4], r[n + 4], o), f(r[t], r[n + 4], r[n], t === 0 && e % 3 == 0 ? s : o);
		}
	}
	p(-.72, 0, .28, .2, .17, .24, .35, !0), p(.66, 0, -.34, .27, .12, .24, .55), p(-.04, 0, .47, .44, .1, .21, .48, !0);
	let m = new o.BufferGeometry();
	return m.setAttribute("position", new o.Float32BufferAttribute(t, 3)), m.setAttribute("color", new o.Float32BufferAttribute(n, 3)), m.setIndex(r), m.computeVertexNormals(), m.computeBoundingBox(), m.computeBoundingSphere(), m;
}
//#endregion
//#region src/island/course-landscape-geometry.ts
function nu(e) {
	if (e.groundHeights && (e.groundHeights.length !== pa.length || !e.groundHeights.every(Number.isFinite))) throw Error("Rock bank ground samples must match the model profile");
	let t = Oa(e).map((e) => new o.Vector3(e.x, e.y, e.z)), n = [], r = [], i = [], a = ma, s = (e, t, a, o) => {
		let s = n.length / 3;
		for (let [i, s] of [
			e,
			t,
			a
		].entries()) {
			let e = o[i];
			n.push(s.x, s.y, s.z), r.push(e.r, e.g, e.b);
		}
		i.push(s, s + 1, s + 2);
	};
	a.forEach(([n, r, i], a) => {
		let o = ha[a];
		s(t[n], t[r], t[i], [
			n,
			r,
			i
		].map((t) => Sa(pa[t], o, e.meadow)));
	});
	let c = new o.BufferGeometry();
	return c.setAttribute("position", new o.Float32BufferAttribute(n, 3)), c.setAttribute("color", new o.Float32BufferAttribute(r, 3)), c.setIndex(i), c.computeVertexNormals(), c.computeBoundingBox(), c.computeBoundingSphere(), c;
}
function ru(e) {
	if (!e.length) return null;
	try {
		let t = ie(e, !1);
		if (!t) throw Error("Course landscape attributes must share one material contract");
		return t.computeBoundingBox(), t.computeBoundingSphere(), t;
	} finally {
		for (let t of e) t.dispose();
	}
}
function iu(e) {
	let t = e.spring ? Ml(e.spring) : null, n = t ? [t.bank, ...t.stones] : [], r = /* @__PURE__ */ new Set(), i;
	try {
		for (let t of e.outcrops) {
			let e = t.feature === "ruin" ? tu(t) : nu(t);
			n.push(e), t.feature !== "ruin" && r.add(e);
		}
		let t = Array.from({ length: wa("stone") }, (e, t) => Ea("stone", t));
		try {
			for (let i of e.stones ?? []) {
				let e = t[Ta("stone", i.x, i.z)].clone().scale(i.size, i.size, i.size).rotateY(i.turn).translate(i.x, i.y, i.z);
				n.push(e), r.add(e);
			}
		} finally {
			for (let e of t) e.dispose();
		}
		let a = 0, o = n.flatMap((e) => {
			let t = e.index?.count ?? e.getAttribute("position").count, n = {
				start: a,
				count: t
			};
			return a += t, r.has(e) ? [n] : [];
		});
		i = ru(n.splice(0)), i && (i.userData.clayStoneRanges = o, i.userData.clayStoneContacts = [...(e.canopy ?? []).map((e) => ({
			x: e.x,
			z: e.z,
			radius: e.size * .12 + .04
		})), ...e.flora.filter((e) => e.supportId).map((e) => ({
			x: e.x,
			z: e.z,
			radius: e.radius + .04
		}))]);
	} catch (e) {
		throw n.forEach((e) => e.dispose()), t?.water.dispose(), t?.fall.dispose(), e;
	}
	let a = new o.Matrix4(), s = new o.Quaternion(), c = new o.Vector3(), l = new o.Vector3(), u = new o.Vector3(0, 1, 0), d = {
		fir: U("fir", "course"),
		broadleaf: U("broadleaf", "course"),
		flowers: U("flowers"),
		grass: U("grass"),
		fern: U("fern"),
		leafy: U("leafy"),
		mushroom: U("mushroom"),
		fence: U("fence")
	}, f = null;
	try {
		for (let e of Object.values(d)) Zs(e);
		f = ru([
			...[
				...e.canopy ?? [],
				...e.flora,
				...(e.borders ?? []).map((e) => ({
					...e,
					asset: "fence"
				}))
			].map((e) => d[e.asset].clone().applyMatrix4(a.compose(l.set(e.x, e.y, e.z), s.setFromAxisAngle(u, e.turn), c.setScalar(e.size)))),
			...(e.stalls ?? []).map((e) => tc(e.feet).scale(e.size, e.size, e.size).rotateY(e.turn).translate(e.x, e.y, e.z)),
			...(e.academies ?? []).map((e) => cc(e.foundationY).scale(e.size, e.size, e.size).rotateY(e.turn).translate(e.x, e.y, e.z))
		]);
	} catch (e) {
		throw i?.dispose(), t?.water.dispose(), t?.fall.dispose(), e;
	} finally {
		for (let e of Object.values(d)) e.dispose();
	}
	let p = (i?.index?.count ?? 0) / 3 + (f?.index?.count ?? 0) / 3 + (t?.water.index?.count ?? 0) / 3 + (t?.fall.index?.count ?? 0) / 3;
	if (p > Aa.triangles) throw i?.dispose(), f?.dispose(), t?.water.dispose(), t?.fall.dispose(), Error("Course landscape geometry exceeds its bounded budget");
	return {
		rock: i,
		flora: f,
		water: t?.water ?? null,
		fall: t?.fall ?? null,
		mist: e.spring ? Nl(e.spring) : null,
		triangles: p,
		dispose: () => {
			i?.dispose(), f?.dispose(), t?.water.dispose(), t?.fall.dispose();
		}
	};
}
//#endregion
//#region src/island/course-landscape-render.tsx
function au({ blueprint: i, dressing: a, scale: s, plan: c }) {
	let l = n(() => c ?? dc(i, a), [
		c,
		i,
		a
	]), u = n(() => {
		let e = iu(l);
		return e.rock && Zl(e.rock), e;
	}, [l]), d = n(() => $l("stone"), []);
	t(() => (d.activate(), () => d.dispose()), [d]);
	let f = n(() => {
		let e = new o.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .96,
			metalness: 0,
			userData: { surfaceDetailInfo: d.info }
		});
		return e.onBeforeCompile = d.onBeforeCompile, e.customProgramCacheKey = d.customProgramCacheKey, e;
	}, [d]), p = n(() => eu(), []);
	t(() => (p.activate(), () => p.dispose()), [p]);
	let m = n(() => {
		let e = new o.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .96,
			metalness: 0,
			userData: { surfaceDetailInfo: p.info }
		});
		return e.onBeforeCompile = p.onBeforeCompile, e.customProgramCacheKey = p.customProgramCacheKey, e;
	}, [p]), h = n(() => dl("still"), []), g = n(() => dl("fall", h.uniforms), [h]), _ = wc(), v = r(null);
	ee(({ clock: e }) => {
		let t = !_ && !ol();
		h.uniforms.uSpringFlowTime.value = t ? e.elapsedTime : 0;
		let n = v.current;
		if (!n || !u.mist) return;
		let r = n.geometry.getAttribute("position"), i = t ? e.elapsedTime : 0;
		for (let e = 0; e < r.count; e += 1) r.setXYZ(e, u.mist[e * 3] + Math.sin(i * .31 + e * 1.7) * .25, u.mist[e * 3 + 1] + Math.sin(i * .47 + e * 2.3) * .35, u.mist[e * 3 + 2] + Math.cos(i * .29 + e * 1.1) * .25);
		r.needsUpdate = !0;
	});
	let y = n(() => {
		let e = new o.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .16,
			metalness: 0,
			side: o.DoubleSide,
			userData: {}
		});
		return e.onBeforeCompile = h.onBeforeCompile, e.customProgramCacheKey = h.customProgramCacheKey, e;
	}, [h]), b = n(() => {
		let e = new o.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .3,
			metalness: 0,
			side: o.DoubleSide,
			transparent: !0,
			depthWrite: !1
		});
		return e.onBeforeCompile = g.onBeforeCompile, e.customProgramCacheKey = g.customProgramCacheKey, e;
	}, [g]), x = n(() => new o.PointsMaterial({
		map: Fl(),
		color: 16777215,
		size: 5,
		sizeAttenuation: !0,
		transparent: !0,
		opacity: .3,
		depthWrite: !1
	}), []), S = n(() => {
		if (!u.mist) return null;
		let e = new o.BufferGeometry();
		return e.setAttribute("position", new o.Float32BufferAttribute(u.mist.slice(), 3)), e;
	}, [u]);
	return e(() => () => S?.dispose(), [S]), e(() => () => {
		b.dispose(), x.dispose();
	}, [b, x]), e(() => () => u.dispose(), [u]), e(() => () => m.dispose(), [m]), e(() => () => {
		f.dispose();
	}, [f]), e(() => () => y.dispose(), [y]), /* @__PURE__ */ (0, z.jsxs)("group", {
		name: "course-landscape",
		scale: s,
		userData: { landscapeReport: {
			search: l.search,
			outcropCount: l.outcrops.length,
			ruinCount: l.outcrops.filter((e) => e.feature === "ruin").length,
			floraCount: l.flora.length,
			meadowBedCount: l.meadowBeds?.length ?? 0,
			meadowFloraCount: l.flora.filter((e) => e.anchorId.startsWith("meadow/")).length,
			leafyCount: l.flora.filter((e) => e.asset === "leafy").length,
			mushroomCount: l.flora.filter((e) => e.asset === "mushroom").length,
			borderCount: l.borders?.length ?? 0,
			groundStoneCount: l.stones?.length ?? 0,
			stallCount: l.stalls?.length ?? 0,
			shoulderTreeCount: l.canopy?.length ?? 0,
			academyCount: l.academies?.length ?? 0,
			springCount: +!!l.spring,
			triangles: u.triangles
		} },
		children: [
			u.rock ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "course-rock-outcrops",
				geometry: u.rock,
				material: f,
				castShadow: !0,
				receiveShadow: !0
			}) : null,
			u.flora ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "course-garden-flora",
				geometry: u.flora,
				material: m,
				castShadow: !0,
				receiveShadow: !0
			}) : null,
			u.water ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "course-coastal-spring",
				geometry: u.water,
				material: y,
				receiveShadow: !0
			}) : null,
			u.fall ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "course-spring-fall",
				geometry: u.fall,
				material: b,
				renderOrder: 3
			}) : null,
			S ? /* @__PURE__ */ (0, z.jsx)("points", {
				ref: v,
				name: "course-spring-mist",
				geometry: S,
				material: x,
				renderOrder: 4,
				frustumCulled: !1
			}) : null
		]
	});
}
//#endregion
//#region src/island/course-facility-material.ts
function ou(e) {
	return (t, n) => {
		if (!(t instanceof o.MeshStandardMaterial)) return;
		let r = {
			uFacilityModel: { value: n.clone() },
			uFacilityCraft: { value: 1 }
		};
		t.userData.facilityCraft = {
			profile: e,
			uniforms: r,
			source: "University authored analytic finish; donor maps preserved"
		}, t.customProgramCacheKey = () => `university-facility-craft-v1/${e}`, t.onBeforeCompile = (t) => {
			Object.assign(t.uniforms, r), t.vertexShader = t.vertexShader.replace("#include <common>", "#include <common>\nuniform mat4 uFacilityModel;\nvarying vec3 vFacilityPoint;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFacilityPoint = (uFacilityModel * vec4(transformed, 1.0)).xyz;"), t.fragmentShader = t.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uFacilityCraft;\nvarying vec3 vFacilityPoint;").replace("#include <color_fragment>", `#include <color_fragment>
          ${e === "roof" ? "\n          // The donated roof contains plaster gables as well as teal panels.\n          // Its actual sampled pigment, not mesh names, selects those panels.\n          float craftMask = smoothstep(0.018, 0.075, diffuseColor.g - diffuseColor.r)\n            * smoothstep(0.0, 0.045, diffuseColor.b - diffuseColor.r);\n          float craftAxis = vFacilityPoint.z * 5.0;\n          float craftAA = max(fwidth(craftAxis), 0.0001);\n          float craftSeam = 1.0 - smoothstep(0.025 - craftAA, 0.055 + craftAA,\n            abs(fract(craftAxis + 0.5) - 0.5));\n          float craftVisibility = 1.0 - smoothstep(0.12, 0.36, craftAA);\n          float craftWear = craftSeam * craftVisibility * craftMask * uFacilityCraft;\n          diffuseColor.rgb *= 1.0 + craftWear * 0.28;\n          " : "\n          float craftMask = smoothstep(0.015, 0.11, diffuseColor.r - diffuseColor.g);\n          float craftAxis = vFacilityPoint.x * 28.0 + sin(vFacilityPoint.z * 2.7) * 0.4;\n          float craftVisibility = 1.0 - smoothstep(0.5, 2.0, fwidth(craftAxis));\n          float craftWear = sin(craftAxis) * craftVisibility * craftMask * uFacilityCraft;\n          diffuseColor.rgb *= 1.0 + craftWear * 0.035;\n          "}
        `).replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor - abs(craftWear) * ${e === "roof" ? "0.12" : "0.035"}, 0.5, 1.0);
        `);
		};
	};
}
var su = ou("roof"), cu = ou("timber");
function lu(e) {
	if (/^fantasy-town-kit\/roof(?:-gable)?$/.test(e)) return su;
	if (/^fantasy-town-kit\/stall(?:-bench)?$/.test(e)) return cu;
}
//#endregion
//#region src/island/island-dressing-render.tsx
var uu = {
	"nature-kit/rock_largeA": "large",
	"nature-kit/rock_smallA": "small"
};
function du({ variant: e, at: t }) {
	let r = n(() => {
		let n = Array.from({ length: wa(e) }, () => []);
		for (let r of t) n[Ta(e, r.position.x, r.position.z)].push(r);
		return n;
	}, [e, t]);
	return /* @__PURE__ */ (0, z.jsx)(z.Fragment, { children: r.map((t, n) => t.length ? /* @__PURE__ */ (0, z.jsx)(fu, {
		variant: e,
		alternative: n,
		at: t
	}, n) : null) });
}
function fu({ variant: i, alternative: a, at: s }) {
	let c = n(() => Ea(i, a), [i, a]), l = n(() => new o.MeshStandardMaterial({
		vertexColors: !0,
		roughness: .95,
		metalness: 0
	}), []);
	e(() => () => c.dispose(), [c]), e(() => () => l.dispose(), [l]);
	let u = r(null);
	return t(() => {
		let e = u.current;
		if (!e) return;
		let t = new o.Matrix4(), n = new o.Quaternion(), r = new o.Vector3(0, 1, 0);
		s.forEach((i, a) => {
			n.setFromAxisAngle(r, i.turn ?? 0), t.compose(i.position, n, new o.Vector3(i.height, i.height, i.height)), e.setMatrixAt(a, t);
		}), e.instanceMatrix.needsUpdate = !0, e.computeBoundingSphere();
	}, [s]), /* @__PURE__ */ (0, z.jsx)("instancedMesh", {
		ref: u,
		name: `course-boulders-${i}-${a}`,
		args: [
			c,
			l,
			s.length
		],
		castShadow: !0,
		receiveShadow: !0
	});
}
function pu(e, t, n = 1, r) {
	let i = /* @__PURE__ */ new Map();
	for (let a of e.placements) {
		if (pc(a) || r?.has(a.id)) continue;
		let e = Et(a.packId, a.assetId);
		if (!e) continue;
		let s = `${e.pack}/${e.assetId}`, c = i.get(s) ?? {
			pack: e.pack,
			src: e.src,
			at: []
		};
		c.at.push({
			position: new o.Vector3(a.x * t, a.y * t, a.z * t),
			height: a.height * t * n * (e.heightScale ?? 1),
			turn: a.turn
		}), i.set(s, c);
	}
	return [...i.entries()].map(([e, t]) => ({
		key: e,
		...t
	}));
}
var mu = /* @__PURE__ */ new Set(["/models/elemental-serenity/camp.glb", "/models/elemental-serenity/bridge.glb"]);
function hu(e) {
	return mu.has(e);
}
function gu(e) {
	let t = [], n = [];
	for (let r of e) r.pack !== "nature-kit" && hu(r.src) ? t.push({
		src: r.src,
		at: r.at
	}) : n.push(r);
	return {
		batched: t,
		fallback: n
	};
}
function _u(e, t) {
	return `${e.studyId}/${e.courseId}/${e.seed}/${e.layoutRevision}/${e.lessonCount}/${t}`;
}
function vu({ blueprint: t, detail: r, targetRadius: a }) {
	let o = _u(t, r), [s, c] = i("");
	e(() => {
		c("");
		let e, t = requestAnimationFrame(() => {
			e = requestAnimationFrame(() => c(o));
		});
		return () => {
			cancelAnimationFrame(t), e !== void 0 && cancelAnimationFrame(e);
		};
	}, [r, o]);
	let l = s === o, u = n(() => l ? Vs(t, r) : null, [
		l,
		t,
		r
	]), d = Ur(t, r, a), f = n(() => u ? dc(t, u) : null, [t, u]), p = n(() => f ? lc(f) : void 0, [f]), m = n(() => u ? pu(u, d, 1, p) : [], [
		u,
		d,
		p
	]), h = n(() => gu(m), [m]);
	return !u || !f ? null : /* @__PURE__ */ (0, z.jsxs)("group", {
		name: "island-dressing-course",
		userData: { islandDressingReady: !0 },
		children: [
			h.batched.length > 0 ? /* @__PURE__ */ (0, z.jsx)(gt, {
				fields: h.batched,
				name: "course-elemental-batch",
				castShadow: !0,
				colorSource: "material",
				roughness: 1
			}) : null,
			h.fallback.map((e) => uu[e.key] ? /* @__PURE__ */ (0, z.jsx)(du, {
				variant: uu[e.key],
				at: e.at
			}, e.key) : /* @__PURE__ */ (0, z.jsx)(ot, {
				src: e.src,
				at: e.at,
				preserveMap: e.pack !== "nature-kit",
				castShadow: !0,
				materialTreatment: lu(e.key)
			}, e.key)),
			/* @__PURE__ */ (0, z.jsx)(hc, {
				plan: u,
				scale: d
			}),
			/* @__PURE__ */ (0, z.jsx)(Gc, {
				plan: u,
				scale: d
			}),
			/* @__PURE__ */ (0, z.jsx)(au, {
				blueprint: t,
				dressing: u,
				scale: d,
				plan: f
			})
		]
	});
}
var yu = .81, bu = .792, xu = {
	course: {
		desktop: 8e4,
		mobile: 24e3
	},
	world: {
		desktop: 0,
		mobile: 0
	}
}, Su = 6.4, Cu = {
	nearToMid: 48,
	midToNear: 42,
	midToFar: 92,
	farToMid: 82
}, wu = {
	near: {
		densityMultiplier: 1,
		heightMultiplier: 1
	},
	mid: {
		densityMultiplier: .45,
		heightMultiplier: 1.15
	},
	far: {
		densityMultiplier: 0,
		heightMultiplier: 1.15
	}
};
function Tu(e, t = null) {
	let n = Number.isFinite(e) ? Math.max(0, e) : Infinity;
	return t === "near" ? n >= Cu.nearToMid ? "mid" : "near" : t === "mid" ? n < Cu.midToNear ? "near" : n >= Cu.midToFar ? "far" : "mid" : t === "far" ? n <= Cu.farToMid ? "mid" : "far" : n < Cu.nearToMid ? "near" : n < Cu.midToFar ? "mid" : "far";
}
function Eu(e, t) {
	return Math.min(e.placements.length, Math.round(e.placements.length * wu[t].densityMultiplier));
}
var Du = Math.PI * 2, Ou = Math.PI * (3 - Math.sqrt(5)), ku = .26, Au = 4900, ju = {
	desktop: 23,
	mobile: 6.2
}, Mu = .8, Nu = .52, Pu = 1.35, Fu = .78, Iu = 96;
function Lu(e, t) {
	if (typeof e != "number" || !Number.isFinite(e) || e < 0) throw RangeError(`IslandGrass ${t} must be finite and non-negative`);
	return e;
}
function Ru(e) {
	if (typeof e != "string" || e.trim().length === 0) throw TypeError("IslandGrass seed must be a non-empty string");
	return e;
}
function zu(e, t) {
	return Math.hypot(e.x - t.x, e.z - t.z);
}
function Bu(e) {
	let t = Math.min(1, Math.max(0, e));
	return t * t * (3 - 2 * t);
}
function Vu(e, t, n) {
	return xr(e, "grass", t, n);
}
function Hu(e) {
	return Bu((e - ku) / .42000000000000004);
}
function Uu(e, t, n) {
	let r = e.nodes.map((n, r) => ({
		x: n.x,
		z: n.z,
		radius: Wu(e) + t + (r === 0 ? Pu : 0),
		kind: "node"
	})), i = {
		x: e.hero.x,
		z: e.hero.z,
		radius: e.hero.radius + n,
		kind: "hero"
	};
	return [...r, i];
}
function Wu(e) {
	return Math.max(0, e.route.nodeRadius);
}
function Gu(e, t, n, r) {
	let i = t ?? [];
	return i.forEach((e, t) => {
		if (!Number.isFinite(e.x) || !Number.isFinite(e.z)) throw RangeError(`IslandGrass safetyZones[${t}] point must be finite`);
		if (!Number.isFinite(e.radius) || e.radius < 0) throw RangeError(`IslandGrass safetyZones[${t}] radius must be non-negative`);
	}), [...Uu(e, n, r), ...i];
}
function Ku(e, t, n) {
	let r = n?.tier ?? "desktop";
	if (r !== "desktop" && r !== "mobile") throw RangeError("IslandGrass tier must be desktop or mobile");
	if (t !== "course" && t !== "world") throw RangeError("IslandGrass detail must be course or world");
	let i = Lu(n?.density ?? ju[r], "density"), a = n?.maxCount === void 0 ? xu[t][r] : Lu(n.maxCount, "maxCount"), o = Math.min(xu[t][r], Math.floor(a));
	return {
		detail: t,
		tier: r,
		seed: Ru(n?.seed ?? e.seed),
		density: i,
		maxCount: o,
		routeGap: Lu(n?.routeGap ?? Mu, "routeGap"),
		nodeGap: Lu(n?.nodeGap ?? Nu, "nodeGap"),
		heroGap: Lu(n?.heroGap ?? Fu, "heroGap"),
		safetyZones: Gu(e, n?.safetyZones, Lu(n?.nodeGap ?? Nu, "nodeGap"), Lu(n?.heroGap ?? Fu, "heroGap"))
	};
}
function qu(e) {
	let t = Math.PI * Math.abs(e.bounds.halfX * e.bounds.halfZ) * yu ** 2;
	return Math.max(t, Au);
}
function Ju(e, t) {
	let n = Infinity;
	for (let r of t) n = Math.min(n, zu(e, r) - r.radius);
	return n;
}
function Yu(e, t, n, r, i, a) {
	let o = G(t, n.x, n.z);
	return !(!o.inside || r > .81 || o.shore > bu || Y(e, n) < a || Ju(n, i) < 0);
}
var Xu = 32, Zu = /* @__PURE__ */ new WeakMap();
function Qu(e, t) {
	let n = q(e, "course", t.x, t.z);
	if (!n.inside) return [
		0,
		1,
		0
	];
	let r = Math.min(.45, Math.max(.08, e.bounds.maxHalf * .004)), i = (t, r) => {
		let i = q(e, "course", t, r);
		return i.inside ? i.y : n.y;
	}, a = (i(t.x + r, t.z) - i(t.x - r, t.z)) / (2 * r), o = (i(t.x, t.z + r) - i(t.x, t.z - r)) / (2 * r), s = Math.hypot(a, 1, o) || 1;
	return [
		-a / s,
		1 / s,
		-o / s
	];
}
function $u(e, t, n) {
	return e + (t - e) * n;
}
function ed(e) {
	let t = Zu.get(e);
	if (t !== void 0) return t;
	let n = Xu, r = /* @__PURE__ */ new Float32Array(3072), i = e.bounds.halfX, a = e.bounds.halfZ;
	for (let t = 0; t < n; t += 1) {
		let o = $u(-a, a, t / 31);
		for (let a = 0; a < n; a += 1) {
			let s = Qu(e, {
				x: $u(-i, i, a / 31),
				z: o
			}), c = (t * n + a) * 3;
			r[c] = s[0], r[c + 1] = s[1], r[c + 2] = s[2];
		}
	}
	let o = {
		resolution: n,
		halfX: i,
		halfZ: a,
		normals: r
	};
	return Zu.set(e, o), o;
}
function td(e, t) {
	let n = ed(e), r = Math.min(1, Math.max(0, (t.x + n.halfX) / (n.halfX * 2))), i = Math.min(1, Math.max(0, (t.z + n.halfZ) / (n.halfZ * 2))), a = r * (n.resolution - 1), o = i * (n.resolution - 1), s = Math.floor(a), c = Math.floor(o), l = Math.min(n.resolution - 1, s + 1), u = Math.min(n.resolution - 1, c + 1), d = a - s, f = o - c, p = (e) => {
		let t = (t, r) => n.normals[(r * n.resolution + t) * 3 + e] ?? 0;
		return $u($u(t(s, c), t(l, c), d), $u(t(s, u), t(l, u), d), f);
	}, m = p(0), h = p(1), g = p(2), _ = Math.hypot(m, h, g) || 1;
	return [
		m / _,
		h / _,
		g / _
	];
}
function nd(e, t, n) {
	let r = Ku(e, t, n), i = [], a = Math.min(r.maxCount, Math.round(qu(e) * r.density * (t === "course" ? Su : 1))), o = e.route.roadWidth / 2 + e.route.shoulderWidth + r.routeGap, s = R(`${r.seed}/${e.layoutRevision}/grass/${t}/${r.tier}`), c = a * Iu + 256;
	if (a === 0) return {
		version: 3,
		detail: t,
		tier: r.tier,
		seed: r.seed,
		density: r.density,
		maxCount: r.maxCount,
		topMaxRadial: yu,
		placements: i
	};
	let l = br(e);
	for (let t = 0; t < c && i.length < a; t += 1) {
		let n = yu * Math.sqrt(s()), a = (t * Ou + s() * Du) % Du, c = {
			x: Math.cos(a) * e.bounds.halfX * n,
			z: Math.sin(a) * e.bounds.halfZ * n
		}, u = Hu(Vu(l, c.x, c.z));
		if (u <= 0 || s() > u || !Yu(e, l, c, n, r.safetyZones, o)) continue;
		let d = q(e, "course", c.x, c.z);
		i.push({
			x: c.x,
			z: c.z,
			y: d.y,
			width: .6 + s() * .24,
			height: .42 + s() * .22,
			rotation: s() * Du,
			phase: s(),
			radial: d.radial,
			groundNormal: td(e, c)
		});
	}
	return {
		version: 3,
		detail: t,
		tier: r.tier,
		seed: r.seed,
		density: r.density,
		maxCount: r.maxCount,
		topMaxRadial: yu,
		placements: i
	};
}
//#endregion
//#region src/sky/tier.ts
function rd() {
	let e = typeof matchMedia == "function" && matchMedia("(pointer: coarse)").matches, t = typeof window < "u" && Math.min(window.innerWidth, window.innerHeight) < 720;
	return e || t ? "mobile" : "desktop";
}
//#endregion
//#region src/island/island-grass-render.tsx
var id = new o.Color(4157752), ad = new o.Color(11591555), od = new o.Color(2972719), sd = 43, cd = 88, ld = 30;
function ud(e, t) {
	return e !== void 0 && Number.isFinite(e) ? e : t;
}
function dd(e) {
	let t = (e + 16) / 116;
	return e > 8 ? t * t * t : e / 903.2962963;
}
function fd(e, t, n) {
	let r = e === void 0 ? t.clone() : new o.Color(e), i = .2126 * r.r + .7152 * r.g + .0722 * r.b;
	return i <= 2 ** -52 ? r : r.multiplyScalar(dd(n) / i);
}
function pd(e) {
	let t = e?.windDirection ?? [.78, .62], n = Math.hypot(t[0] ?? 0, t[1] ?? 0), r = n > 2 ** -52 ? t : [1, 0], i = n > 2 ** -52 ? n : 1;
	return {
		bottom: fd(e?.bottom, id, sd),
		top: fd(e?.top, ad, cd),
		shadow: fd(e?.shadow, od, ld),
		windStrength: Math.max(0, ud(e?.windStrength, .065)),
		windSpeed: Math.max(0, ud(e?.windSpeed, 1.15)),
		windFrequency: Math.max(0, ud(e?.windFrequency, .24)),
		windDirection: new o.Vector2((r[0] ?? 0) / i, (r[1] ?? 0) / i)
	};
}
function md(e) {
	let t = pd(e);
	return {
		uTime: { value: 0 },
		uWindStrength: { value: t.windStrength },
		uWindSpeed: { value: t.windSpeed },
		uWindFrequency: { value: t.windFrequency },
		uWindDirection: { value: t.windDirection },
		uGrassBottom: { value: t.bottom },
		uGrassTop: { value: t.top },
		uGrassShadow: { value: t.shadow },
		uGrassHeightScale: { value: 1 },
		uGroundNormalStrength: { value: .72 }
	};
}
function hd(e, t) {
	let n = pd(t);
	e.uWindStrength.value = n.windStrength, e.uWindSpeed.value = n.windSpeed, e.uWindFrequency.value = n.windFrequency, e.uWindDirection.value.copy(n.windDirection), e.uGrassBottom.value.copy(n.bottom), e.uGrassTop.value.copy(n.top), e.uGrassShadow.value.copy(n.shadow);
}
function gd() {
	let e = new Float32Array([
		-.14,
		0,
		0,
		.14,
		0,
		0,
		0,
		1,
		0
	]), t = new Float32Array([
		0,
		0,
		1,
		0,
		.5,
		1
	]), n = new o.BufferGeometry();
	return n.name = "IslandGrassBladeGeometry", n.setAttribute("position", new o.Float32BufferAttribute(e, 3)), n.setAttribute("uv", new o.Float32BufferAttribute(t, 2)), n.setIndex([
		0,
		1,
		2
	]), n.computeVertexNormals(), n.computeBoundingSphere(), n;
}
var _d = "/* university island donor grass, lit */", vd = `${_d}
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindFrequency;
uniform vec2 uWindDirection;
uniform float uGrassHeightScale;
uniform float uGroundNormalStrength;
attribute vec3 aGrassGroundNormal;
varying float vBladeHeight;
vec2 grassWindAt(vec3 grassBaseWorld) {
  vec2 grassDirection = uWindDirection;
  float grassDirectionLength = length(grassDirection);
  grassDirection = grassDirectionLength > 0.0001
    ? grassDirection / grassDirectionLength
    : vec2(1.0, 0.0);
  vec2 grassCross = vec2(-grassDirection.y, grassDirection.x);
  float grassWavePhase = dot(grassBaseWorld.xz, grassDirection) * uWindFrequency;
  float grassGustPhase = dot(grassBaseWorld.xz, grassCross) * uWindFrequency * 0.58;
  float grassWave =
    sin(grassWavePhase + uTime * uWindSpeed) * 0.78 +
    sin(grassGustPhase + uTime * uWindSpeed * 0.72 + 1.7) * 0.22;
  float grassGust = sin(grassGustPhase + uTime * uWindSpeed * 0.51 + 0.9) * 0.2;
  return (grassDirection * grassWave + grassCross * grassGust) * uWindStrength;
}

vec3 grassRotateAxis(vec3 point, vec3 axis, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return point * cosine + cross(axis, point) * sine + axis * dot(axis, point) * (1.0 - cosine);
}
`, yd = `${_d}
#ifdef USE_INSTANCING
  mat4 grassNormalInstanceWorld = modelMatrix * instanceMatrix;
#else
  mat4 grassNormalInstanceWorld = modelMatrix;
#endif
vec3 grassNormalBase = (grassNormalInstanceWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 grassNormalToCamera = cameraPosition - grassNormalBase;
vec3 grassBillboardNormal = vec3(0.0, 1.0, 0.0);
if (length(grassNormalToCamera.xz) > 0.0001) {
  vec2 grassCameraDirection = normalize(grassNormalToCamera.xz);
  grassBillboardNormal = vec3(grassCameraDirection.x, 0.0, grassCameraDirection.y);
}
vec3 grassTerrainNormal = aGrassGroundNormal;
if (dot(grassTerrainNormal, grassTerrainNormal) < 0.0001) {
  grassTerrainNormal = vec3(0.0, 1.0, 0.0);
}
vec3 grassWorldNormal = normalize(
  mix(grassBillboardNormal, normalize(grassTerrainNormal), uGroundNormalStrength)
);
float grassNormalHeight = clamp(position.y, 0.0, 1.0);
vec2 grassNormalWind = grassWindAt(grassNormalBase);
vec3 grassNormalWindDirection = vec3(grassNormalWind.x, 0.0, grassNormalWind.y);
float grassNormalWindAmount = length(grassNormalWindDirection);
if (grassNormalWindAmount > 0.0001) {
  vec3 grassNormalBendAxis = normalize(cross(vec3(0.0, 1.0, 0.0), grassNormalWindDirection));
  grassWorldNormal = grassRotateAxis(
    grassWorldNormal,
    grassNormalBendAxis,
    grassNormalWindAmount * grassNormalHeight * grassNormalHeight * 2.4
  );
}
transformedNormal = normalize(mat3(viewMatrix) * grassWorldNormal);
`, bd = `${_d}
float grassHeight = clamp(position.y, 0.0, 1.0);
vBladeHeight = grassHeight;
#ifdef USE_INSTANCING
  mat4 grassProjectInstanceWorld = modelMatrix * instanceMatrix;
  float grassProjectInstanceYaw = atan(instanceMatrix[2].x, instanceMatrix[2].z);
#else
  mat4 grassProjectInstanceWorld = modelMatrix;
  float grassProjectInstanceYaw = 0.0;
#endif
vec3 grassBase = (grassProjectInstanceWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 grassLocal = transformed;
grassLocal.y *= uGrassHeightScale;
float grassTaper = max(0.08, pow(max(0.0, 1.0 - grassHeight), 0.72));
grassLocal.xz *= grassTaper;
float grassBillboardAngle = atan(cameraPosition.x - grassBase.x, cameraPosition.z - grassBase.z);
float grassLocalBillboardAngle = grassBillboardAngle - grassProjectInstanceYaw;
float grassBillboardCosine = cos(grassLocalBillboardAngle);
float grassBillboardSine = sin(grassLocalBillboardAngle);
vec2 grassBillboardXZ = vec2(
  grassLocal.x * grassBillboardCosine + grassLocal.z * grassBillboardSine,
  -grassLocal.x * grassBillboardSine + grassLocal.z * grassBillboardCosine
);
grassLocal.xz = grassBillboardXZ;
vec3 grassWorldOffset = (grassProjectInstanceWorld * vec4(grassLocal, 0.0)).xyz;
vec2 grassWind = grassWindAt(grassBase);
vec3 grassWindDirection = vec3(grassWind.x, 0.0, grassWind.y);
float grassWindAmount = length(grassWindDirection);
if (grassWindAmount > 0.0001) {
  vec3 grassBendAxis = normalize(cross(vec3(0.0, 1.0, 0.0), grassWindDirection));
  grassWorldOffset = grassRotateAxis(
    grassWorldOffset,
    grassBendAxis,
    grassWindAmount * grassHeight * grassHeight * 2.4
  );
}
vec4 grassWorld = vec4(grassBase + grassWorldOffset, 1.0);
vec4 mvPosition = viewMatrix * grassWorld;
gl_Position = projectionMatrix * mvPosition;
`, xd = `${_d}
uniform vec3 uGrassBottom;
uniform vec3 uGrassTop;
uniform vec3 uGrassShadow;
varying float vBladeHeight;
`, Sd = `${_d}
float grassBladeMask = clamp(vBladeHeight, 0.0, 1.0);
vec3 grassColor = mix(uGrassBottom, uGrassTop, smoothstep(0.04, 0.96, grassBladeMask));
// Donor-aligned nonlinear root shadow: roots stay dark while the card opens
// into the full bright ramp toward its tip.
float grassRootToTip = pow(smoothstep(0.2, 0.98, grassBladeMask), 0.5);
grassColor = mix(uGrassShadow, grassColor, grassRootToTip);
diffuseColor.rgb = grassColor;
`;
function Cd(e) {
	let t = md(e), n = new o.MeshStandardMaterial({
		color: 16777215,
		roughness: .68,
		metalness: 0,
		emissive: 4022052,
		emissiveIntensity: .11,
		side: o.FrontSide,
		toneMapped: !1
	});
	return n.name = "IslandGrassMaterial", n.userData.grassUniforms = t, n.customProgramCacheKey = () => "island-grass-billboard-triangle-lit-1", n.onBeforeCompile = (e) => {
		Object.assign(e.uniforms, t), e.vertexShader.includes(_d) || (e.vertexShader = e.vertexShader.replace("#include <common>", `#include <common>\n${vd}`), e.vertexShader = e.vertexShader.replace("#include <defaultnormal_vertex>", `#include <defaultnormal_vertex>\n${yd}`), e.vertexShader = e.vertexShader.replace("#include <project_vertex>", bd)), e.fragmentShader.includes(_d) || (e.fragmentShader = e.fragmentShader.replace("#include <common>", `#include <common>\n${xd}`), e.fragmentShader = e.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\n${Sd}`));
	}, n;
}
function wd(e) {
	return e.userData.grassUniforms ?? null;
}
function Td(e, t) {
	e.dispose(), t.dispose();
}
function Ed(e, t) {
	return {
		...e,
		tier: t
	};
}
function Dd(e) {
	return e.detail === "world" ? null : /* @__PURE__ */ (0, z.jsx)(Od, { ...e });
}
function Od({ blueprint: e, detail: t, targetRadius: r, style: i, options: a }) {
	let o = rd(), s = a?.density, c = a?.maxCount, l = a?.seed, u = a?.routeGap, d = a?.nodeGap, f = a?.heroGap, p = a?.safetyZones, m = n(() => Ed({
		density: s,
		maxCount: c,
		seed: l,
		routeGap: u,
		nodeGap: d,
		heroGap: f,
		safetyZones: p
	}, o), [
		s,
		c,
		l,
		u,
		d,
		f,
		p,
		o
	]), h = n(() => nd(e, t, m), [
		e,
		t,
		m
	]), g = Ur(e, t, r);
	return h.placements.length === 0 ? null : /* @__PURE__ */ (0, z.jsx)(kd, {
		plan: h,
		scale: g,
		style: i
	});
}
function kd({ plan: n, scale: a, style: s }) {
	let c = r(null), l = r(null), [u, d] = i(null), f = te(({ camera: e }) => e), p = r(null), m = r(new o.Vector3());
	return t(() => {
		let e = {
			geometry: gd(),
			material: Cd(s)
		};
		return l.current = e, d(e), () => {
			l.current === e && (l.current = null), Td(e.geometry, e.material);
		};
	}, []), e(() => {
		u && hd(wd(u.material), s);
	}, [u, s]), t(() => {
		let e = c.current;
		if (!e) return;
		let t = new o.Object3D(), r = new Float32Array(n.placements.length * 3);
		p.current = null, e.count = n.placements.length;
		for (let [i, o] of n.placements.entries()) t.position.set(o.x * a, (o.y + .008) * a, o.z * a), t.rotation.set(0, o.rotation + o.phase * .08, 0), t.scale.set(o.width * a, o.height * a * (.86 + o.phase * .28), o.width * a), t.updateMatrix(), e.setMatrixAt(i, t.matrix), r[i * 3] = o.groundNormal[0], r[i * 3 + 1] = o.groundNormal[1], r[i * 3 + 2] = o.groundNormal[2];
		if (e.geometry.setAttribute("aGrassGroundNormal", new o.InstancedBufferAttribute(r, 3)), e.instanceMatrix.needsUpdate = !0, e.computeBoundingSphere(), e.boundingSphere) {
			let t = Math.max(0, ud(s?.windStrength, .065));
			e.boundingSphere.radius += (.42 * a + t) * 1.5;
		}
	}, [
		u,
		n,
		a,
		s?.windStrength
	]), ee(({ clock: e }) => {
		let t = c.current;
		if (!t || !u) return;
		t.getWorldPosition(m.current);
		let r = Tu(f.position.distanceTo(m.current), p.current);
		r !== p.current && (p.current = r, t.count = Eu(n, r));
		let i = wd(u.material);
		i && (i.uGrassHeightScale.value = wu[r].heightMultiplier, i.uTime.value = e.elapsedTime);
	}), u ? /* @__PURE__ */ (0, z.jsx)("instancedMesh", {
		name: "island-grass",
		castShadow: !1,
		receiveShadow: !0,
		ref: c,
		args: [
			u.geometry,
			u.material,
			n.placements.length
		],
		frustumCulled: !0
	}) : null;
}
function Ad() {
	let e = Vt.assets.find((e) => e.id === "plant_bush"), t = new o.BufferGeometry();
	t.setAttribute("position", new o.Float32BufferAttribute(e.vertices.flatMap((e) => [
		e[0] * .36,
		e[1] * .3,
		e[2] * .36
	]), 3)), t.setIndex(e.faces.flat());
	let n = new o.Color(4946239), r = new o.Color(11718501);
	return t.setAttribute("color", new o.Float32BufferAttribute(e.vertices.flatMap((e) => {
		let t = n.clone().lerp(r, Math.min(1, e[1] * .86));
		return [
			t.r,
			t.g,
			t.b
		];
	}), 3)), t.computeVertexNormals(), t;
}
function jd(e, t, n, r) {
	t.computeBoundingBox();
	let i = t.boundingBox, a = t.getAttribute("position"), s = t.getIndex(), c = e.getAttribute("position"), l = e.getIndex(), u = [];
	for (let e = 0; e < s.count; e += 3) u.push(new o.Triangle(...[
		0,
		1,
		2
	].map((t) => new o.Vector3().fromBufferAttribute(a, s.getX(e + t)))));
	let d = new o.Triangle(), f = new o.Box3(), p = new o.Ray(), m = new o.Vector3(), h = new o.Vector3(), g = (e, t, i) => {
		m.subVectors(t, e);
		let a = m.length();
		return a < 1e-8 ? !1 : (p.set(e, m.divideScalar(a)), p.intersectTriangle(i.a, i.b, i.c, !1, h) !== null && h.distanceTo(e) <= a + 1e-6 * r && h.distanceTo(n) > .04 * r);
	};
	for (let e = 0; e < l.count; e += 3) if (d.a.fromBufferAttribute(c, l.getX(e)), d.b.fromBufferAttribute(c, l.getX(e + 1)), d.c.fromBufferAttribute(c, l.getX(e + 2)), f.makeEmpty().expandByPoint(d.a).expandByPoint(d.b).expandByPoint(d.c), i.intersectsBox(f)) {
		for (let e of u) if (g(e.a, e.b, d) || g(e.b, e.c, d) || g(e.c, e.a, d) || g(d.a, d.b, e) || g(d.b, d.c, e) || g(d.c, d.a, e)) return !1;
	}
	return !0;
}
function Md(e, t, n) {
	if (!Number.isFinite(n) || n <= 0) throw RangeError("Invalid cliff garden scale");
	let r = e.userData.cliffTopology, i = e.getAttribute("position"), a = e.getIndex(), s = [];
	if (!r || !a) return {
		geometry: null,
		seats: s
	};
	let c = [], l = new o.Vector3(), u = new o.Vector3(), d = new o.Vector3(), f = new o.Vector3(), p = new o.Vector3();
	for (let e of r.gardenFaces) {
		l.fromBufferAttribute(i, a.getX(e)), u.fromBufferAttribute(i, a.getX(e + 1)), d.fromBufferAttribute(i, a.getX(e + 2)), f.subVectors(u, l), p.subVectors(d, l);
		let r = f.clone().cross(p), o = r.length();
		if (o < 1e-8 || r.y / o < .28) continue;
		let s = u.distanceTo(d), m = l.distanceTo(d), h = l.distanceTo(u), g = s + m + h, _ = o / g, v = l.clone().multiplyScalar(s).addScaledVector(u, m).addScaledVector(d, h).divideScalar(g);
		if (_ < .14 * n || v.y > -.8 * n) continue;
		let y = Math.min(1.05 * n, _ * .72);
		c.push({
			face: e,
			center: v,
			normal: r.divideScalar(o),
			radius: y,
			inradius: _,
			crownRadius: Math.min(1.8 * n, y * 2.8),
			rank: _ / n * (.75 + L(`${t}/${e}/cliff-garden`) * .25)
		});
	}
	let m = Ad(), h = new o.Vector3(0, 1, 0), g = [];
	for (let r of c.sort((e, t) => t.rank - e.rank).slice(0, 36)) {
		if (s.length >= 12) break;
		let i = (e) => Math.floor((Math.atan2(e.z, e.x) + Math.PI) * 12 / (Math.PI * 2));
		if (s.some((e) => i(e.center) === i(r.center)) || s.some((e) => e.center.distanceTo(r.center) < e.crownRadius + r.crownRadius + 2 * n)) continue;
		let a = r.crownRadius / .36, c = new o.Quaternion().setFromUnitVectors(h, r.normal);
		c.multiply(new o.Quaternion().setFromAxisAngle(h, L(`${t}/${r.face}/turn`) * Math.PI * 2));
		let l = new o.Matrix4().compose(r.center.clone().addScaledVector(r.normal, -.012 * n), c, new o.Vector3(a, a, a)), u = m.clone().applyMatrix4(l);
		if (!jd(e, u, r.center, n)) {
			u.dispose();
			continue;
		}
		s.push(r), g.push(u);
	}
	if (g.length === 0) return m.dispose(), {
		geometry: null,
		seats: s
	};
	let _ = ie(g, !1);
	if (g.forEach((e) => e.dispose()), m.dispose(), !_) throw Error("Unable to merge cliff garden");
	return _.computeBoundingSphere(), _.computeBoundingBox(), {
		geometry: _,
		seats: s
	};
}
//#endregion
//#region src/island/course-coast-lip.ts
var Nd = [
	{
		out: -.32,
		down: .02,
		shade: 1
	},
	{
		out: .08,
		down: .03,
		shade: 1
	},
	{
		out: .22,
		down: .3,
		shade: .93
	},
	{
		out: .16,
		down: .62,
		shade: .8
	},
	{
		out: -.1,
		down: .86,
		shade: .62
	}
], Pd = 2.4, Fd = new o.Color(6179641);
function Id(e, t) {
	let n = e.userData.cliffTopology?.ringIndices[0];
	if (!n || n.length < 3 || n.some((e) => e < 0)) return null;
	let r = e.getAttribute("position"), i = e.getAttribute("color"), a = n.length, s = n.map((e) => new o.Vector3().fromBufferAttribute(r, e)), c = s.reduce((e, t) => e.add(t), new o.Vector3()).divideScalar(a), l = [], u = [], d = new o.Color();
	for (let e = 0; e < a; e += 1) {
		let r = s[e], f = s[(e + 1) % a].clone().sub(s[(e - 1 + a) % a]).setY(0), p = new o.Vector3(f.z, 0, -f.x).normalize();
		p.dot(r.clone().sub(c).setY(0)) < 0 && p.negate();
		let m = Pd * (.78 + .22 * Math.sin(e / a * Math.PI * 2 * 5 + L(`${t}/coast-lip`) * 6) + L(`${t}/coast-lip/${Math.floor(e / 3)}`) * .12), h = new o.Color().fromBufferAttribute(i, n[e]);
		for (let e of Nd) l.push(r.x + p.x * e.out * m, r.y - e.down * m, r.z + p.z * e.out * m), d.copy(h).multiplyScalar(e.shade).lerp(Fd, e === Nd.at(-1) ? .45 : 0), u.push(d.r, d.g, d.b);
	}
	let f = Nd.length, p = [];
	for (let e = 0; e < a; e += 1) {
		let t = e * f, n = (e + 1) % a * f;
		for (let e = 0; e < f - 1; e += 1) p.push(t + e, t + e + 1, n + e, n + e, t + e + 1, n + e + 1);
	}
	let m = new o.BufferGeometry();
	m.setAttribute("position", new o.Float32BufferAttribute(l, 3)), m.setAttribute("color", new o.Float32BufferAttribute(u, 3)), m.setIndex(p), m.computeVertexNormals();
	let h = m.getAttribute("normal"), g = new o.Vector3().fromBufferAttribute(h, 2), _ = s[0].clone().sub(c).setY(0).normalize();
	if (g.dot(_) < 0) {
		for (let e = 0; e < p.length; e += 3) {
			let t = p[e + 1];
			p[e + 1] = p[e + 2], p[e + 2] = t;
		}
		m.setIndex(p), m.computeVertexNormals();
	}
	return m.computeBoundingBox(), m.computeBoundingSphere(), m;
}
//#endregion
//#region src/island/island-render.tsx
var Ld = 5924210, Rd = 3160646, zd = 5626367, Bd = 16762714;
function Vd({ blueprint: e, role: r, style: i, vertexColors: a, roughness: o, metalness: s, polygonOffset: c = !1, polygonOffsetFactor: l, timeUniform: u }) {
	let d = n(() => ll(r, i, !1, u), [r, u]), f = n(() => $l("terrain", e), [e]);
	t(() => (f.activate(), () => f.dispose()), [f]);
	let p = n(() => ({
		onBeforeCompile(e, t) {
			d.onBeforeCompile(e, t), f.onBeforeCompile(e);
		},
		customProgramCacheKey: () => `${d.enabled ? d.customProgramCacheKey() : "standard"}/${f.customProgramCacheKey()}`
	}), [d, f]);
	return t(() => {
		d.setStyle(i);
	}, [d, i]), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
		vertexColors: a,
		roughness: o,
		metalness: s,
		polygonOffset: c,
		polygonOffsetFactor: l,
		onBeforeCompile: p.onBeforeCompile,
		customProgramCacheKey: p.customProgramCacheKey,
		userData: { surfaceDetailInfo: f.info }
	}, f.materialKey);
}
function Hd(e, t) {
	return new o.Color(e).multiplyScalar(t ? .64 : 1);
}
function Ud({ blueprint: e, scale: i, depth: a, detail: s, dimmed: c }) {
	let l = r(null), u = r(null), d = r(null), f = s === "world" ? 4 : Math.min(8, Math.max(4, e.underside.ringCount * 2)), p = s === "world" ? .84 : .7, m = e.bounds.halfX * i * p, h = e.bounds.halfZ * i * p, g = Math.max(.05, Math.min(m, h) * .035), _ = n(() => {
		let e = [], t = [], n = -a * (s === "world" ? .68 : .52), r = Math.max(.1, Math.min(m, h) * .075), i = Math.max(.32, a * (s === "world" ? .2 : .14));
		for (let a = 0; a < f; a += 1) {
			let s = a / f * Math.PI * 2 + .2, c = Math.cos(s) * m, l = Math.sin(s) * h;
			e.push(new o.Matrix4().compose(new o.Vector3(c, n, l), new o.Quaternion(), new o.Vector3(r, i, r))), t.push(new o.Matrix4().compose(new o.Vector3(c, n - i * .78, l), new o.Quaternion().setFromEuler(new o.Euler(Math.PI, 0, 0)), new o.Vector3(r * .68, i * .92, r * .68)));
		}
		return {
			bodies: e,
			glows: t
		};
	}, [
		a,
		f,
		m,
		h
	]);
	t(() => {
		let e = u.current, t = d.current;
		e && t && (_.bodies.forEach((t, n) => e.setMatrixAt(n, t)), _.glows.forEach((e, n) => t.setMatrixAt(n, e)), e.instanceMatrix.needsUpdate = !0, t.instanceMatrix.needsUpdate = !0, e.computeBoundingSphere(), t.computeBoundingSphere());
	}, [_]), ee(({ clock: e }) => {
		let t = l.current;
		if (!t) return;
		let n = t.material;
		n instanceof o.MeshBasicMaterial && (n.opacity = .56 + Math.sin(e.elapsedTime * 1.4) * .1);
	});
	let v = -a * (s === "world" ? .6 : .33);
	return /* @__PURE__ */ (0, z.jsxs)("group", { children: [
		/* @__PURE__ */ (0, z.jsxs)("mesh", {
			position: [
				0,
				v,
				0
			],
			rotation: [
				Math.PI / 2,
				0,
				0
			],
			scale: [
				m,
				h,
				g / .06
			],
			children: [/* @__PURE__ */ (0, z.jsx)("torusGeometry", { args: [
				1,
				.06,
				6,
				s === "world" ? 20 : 32
			] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
				color: Hd(Ld, c),
				roughness: .42,
				metalness: .78
			})]
		}),
		/* @__PURE__ */ (0, z.jsxs)("mesh", {
			ref: l,
			position: [
				0,
				v + i * .03,
				0
			],
			rotation: [
				Math.PI / 2,
				0,
				0
			],
			scale: [
				m,
				h,
				g * .45 / .018
			],
			children: [/* @__PURE__ */ (0, z.jsx)("torusGeometry", { args: [
				1,
				.018,
				5,
				s === "world" ? 20 : 32
			] }), /* @__PURE__ */ (0, z.jsx)("meshBasicMaterial", {
				color: c ? Ld : zd,
				transparent: !0,
				opacity: .72,
				depthWrite: !1
			})]
		}),
		/* @__PURE__ */ (0, z.jsxs)("instancedMesh", {
			ref: u,
			args: [
				void 0,
				void 0,
				f
			],
			children: [/* @__PURE__ */ (0, z.jsx)("cylinderGeometry", { args: [
				.72,
				1,
				1,
				s === "world" ? 6 : 8
			] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
				color: Hd(Rd, c),
				roughness: .38,
				metalness: .84
			})]
		}),
		/* @__PURE__ */ (0, z.jsxs)("instancedMesh", {
			ref: d,
			args: [
				void 0,
				void 0,
				f
			],
			children: [/* @__PURE__ */ (0, z.jsx)("coneGeometry", { args: [
				1,
				1,
				s === "world" ? 5 : 7
			] }), /* @__PURE__ */ (0, z.jsx)("meshBasicMaterial", {
				color: c ? Ld : zd,
				transparent: !0,
				opacity: .65,
				depthWrite: !1
			})]
		}),
		/* @__PURE__ */ (0, z.jsxs)("mesh", {
			position: [
				0,
				-a * .26,
				0
			],
			scale: [
				m / p,
				a * .2,
				h / p
			],
			children: [/* @__PURE__ */ (0, z.jsx)("cylinderGeometry", { args: [
				.88,
				.7,
				1,
				s === "world" ? 16 : 26,
				1,
				!0
			] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
				color: Hd(Ld, c),
				roughness: .44,
				metalness: .72,
				side: o.DoubleSide
			})]
		}),
		/* @__PURE__ */ (0, z.jsxs)("mesh", {
			position: [
				0,
				-a * .86,
				0
			],
			children: [/* @__PURE__ */ (0, z.jsx)("sphereGeometry", { args: [
				Math.max(.18, Math.min(m, h) * .1),
				8,
				6
			] }), /* @__PURE__ */ (0, z.jsx)("meshBasicMaterial", {
				color: c ? Ld : zd,
				transparent: !0,
				opacity: c ? .35 : .95
			})]
		})
	] });
}
function Wd({ blueprint: e, scale: t, detail: i, dimmed: a }) {
	let s = r(null), c = n(() => new o.Vector3(e.hero.x * t, e.hero.y * t, e.hero.z * t), [e, t]);
	ee(({ clock: e }) => {
		let t = s.current;
		if (!t) return;
		t.rotation.y = e.elapsedTime * .55;
		let n = 1 + Math.sin(e.elapsedTime * 1.7) * .06;
		t.scale.setScalar(n);
	});
	let l = t * (i === "world" ? 4.2 : 1);
	return /* @__PURE__ */ (0, z.jsxs)("group", {
		position: c,
		rotation: [
			0,
			-e.hero.heading,
			0
		],
		scale: l,
		children: [
			/* @__PURE__ */ (0, z.jsxs)("mesh", {
				position: [
					-.78,
					1.05,
					0
				],
				castShadow: !0,
				children: [/* @__PURE__ */ (0, z.jsx)("boxGeometry", { args: [
					.28,
					2.1,
					.36
				] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
					color: Hd(Rd, a),
					roughness: .5,
					metalness: .55
				})]
			}),
			/* @__PURE__ */ (0, z.jsxs)("mesh", {
				position: [
					.78,
					1.05,
					0
				],
				castShadow: !0,
				children: [/* @__PURE__ */ (0, z.jsx)("boxGeometry", { args: [
					.28,
					2.1,
					.36
				] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
					color: Hd(Rd, a),
					roughness: .5,
					metalness: .55
				})]
			}),
			/* @__PURE__ */ (0, z.jsxs)("mesh", {
				position: [
					0,
					2.02,
					0
				],
				castShadow: !0,
				children: [/* @__PURE__ */ (0, z.jsx)("boxGeometry", { args: [
					1.84,
					.28,
					.36
				] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
					color: Hd(Ld, a),
					roughness: .4,
					metalness: .64
				})]
			}),
			/* @__PURE__ */ (0, z.jsxs)("mesh", {
				ref: s,
				position: [
					0,
					1.35,
					.02
				],
				children: [/* @__PURE__ */ (0, z.jsx)("octahedronGeometry", { args: [.45, 0] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
					color: a ? Ld : zd,
					emissive: a ? 0 : zd,
					emissiveIntensity: a ? 0 : 1.3,
					roughness: .18,
					metalness: .18
				})]
			}),
			/* @__PURE__ */ (0, z.jsxs)("mesh", {
				rotation: [
					-Math.PI / 2,
					0,
					0
				],
				position: [
					0,
					.08,
					0
				],
				children: [/* @__PURE__ */ (0, z.jsx)("cylinderGeometry", { args: [
					1.18,
					1.35,
					.16,
					i === "world" ? 12 : 20
				] }), /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
					color: Hd(Bd, a),
					roughness: .42,
					metalness: .38
				})]
			})
		]
	});
}
function Gd({ blueprint: t, detail: i, targetRadius: a, onClick: s, onPointerOver: c, onPointerOut: l, dimmed: u = !1 }) {
	let d = Kc, f = r({ value: 0 });
	ee(({ clock: e }) => {});
	let p = n(() => {
		let e = Xi(t, i, a);
		return Zl(e.terrain, e.scale), e;
	}, [
		t,
		i,
		a
	]);
	e(() => () => p.terrain.dispose(), [p]);
	let m = n(() => i === "course" ? Md(p.terrain, t.seed, p.scale) : {
		geometry: null,
		seats: []
	}, [
		p,
		t.seed,
		i
	]);
	e(() => () => m.geometry?.dispose(), [m]);
	let h = n(() => i === "course" ? Id(p.terrain, t.seed) : null, [
		p,
		t.seed,
		i
	]);
	return e(() => () => h?.dispose(), [h]), /* @__PURE__ */ (0, z.jsxs)("group", {
		name: i === "course" ? "island-course" : void 0,
		userData: void 0,
		onClick: s ? (e) => {
			e.stopPropagation(), s();
		} : void 0,
		onPointerOver: c ? (e) => {
			e.stopPropagation(), c();
		} : void 0,
		onPointerOut: l ? (e) => {
			e.stopPropagation(), l();
		} : void 0,
		children: [
			/* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "island-terrain",
				geometry: p.terrain,
				castShadow: !0,
				receiveShadow: !0,
				children: /* @__PURE__ */ (0, z.jsx)(Vd, {
					blueprint: t,
					role: "terrain",
					style: d,
					vertexColors: !0,
					roughness: .68,
					metalness: 0,
					timeUniform: f.current
				})
			}),
			h ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "course-coast-lip",
				geometry: h,
				castShadow: !0,
				receiveShadow: !0,
				children: /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
					vertexColors: !0,
					roughness: .86,
					metalness: 0
				})
			}) : null,
			m.geometry ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "course-cliff-garden",
				geometry: m.geometry,
				castShadow: !0,
				receiveShadow: !0,
				userData: { plantCount: m.seats.length },
				children: /* @__PURE__ */ (0, z.jsx)("meshStandardMaterial", {
					vertexColors: !0,
					roughness: .96,
					metalness: 0,
					side: o.DoubleSide
				})
			}) : null,
			i === "world" ? /* @__PURE__ */ (0, z.jsxs)(z.Fragment, { children: [/* @__PURE__ */ (0, z.jsx)(Ud, {
				blueprint: t,
				scale: p.scale,
				depth: p.bounds.depth,
				detail: i,
				dimmed: u
			}), /* @__PURE__ */ (0, z.jsx)(Wd, {
				blueprint: t,
				scale: p.scale,
				detail: i,
				dimmed: u
			})] }) : null
		]
	});
}
//#endregion
//#region src/island/remote-props.ts
function Kd({ blueprint: e, islandPosition: t, islandRadius: n, scale: r = 1, dimmed: i = !1, lift: a = 0, islandId: s }) {
	let c = n * r;
	return Ks(e).props.map((e) => ({
		kind: e.role,
		asset: e.asset,
		position: new o.Vector3(t.x + e.x * c, t.y + a + e.y * c, t.z + e.z * c),
		scale: e.size * c,
		rotationY: e.turn,
		islandId: s,
		dimmed: i,
		triangles: Us(e.asset).triangles
	}));
}
function qd(e) {
	let t = [], n = [], r = [], i = [];
	for (let [a, o] of e.entries()) {
		let e = Kd({
			blueprint: o.blueprint,
			islandPosition: o.position,
			islandRadius: o.radius ?? o.blueprint.bounds.maxHalf,
			lift: o.lift,
			scale: o.scale,
			dimmed: o.dimmed,
			islandId: o.id ?? `island-${a}`
		});
		for (let i of e) (i.kind === "tree" ? n : i.kind === "landmark" ? t : r).push(i);
		let s = Ks(o.blueprint).pool;
		s && i.push({
			island: o,
			pool: s
		});
	}
	let a = [
		...t,
		...n,
		...r
	];
	return {
		landmarks: t,
		trees: n,
		accents: r,
		water: i,
		totalProps: a.length,
		totalTriangles: a.reduce((e, t) => e + t.triangles, 0)
	};
}
//#endregion
//#region src/island/remote-island-field.ts
var Jd = 0, Yd = 8, Xd = /* @__PURE__ */ new WeakMap();
function Zd(e, t) {
	Jd += 1;
	let n = t ?? e.bounds.maxHalf, r = Xi(e, "world", n), i = r.terrain;
	try {
		let e = i.getAttribute("position"), t = i.getAttribute("color"), a = i.getAttribute("normal"), s = i.getIndex(), c = e ? e.count : 0, l = new Float32Array(c * 3), u = new Float32Array(c * 3), d = new Float32Array(c * 3), f = new o.Box3(), p = new o.Vector3();
		for (let n = 0; n < c; n += 1) {
			let r = e.getX(n), i = e.getY(n), o = e.getZ(n);
			l[n * 3] = r, l[n * 3 + 1] = i, l[n * 3 + 2] = o, f.expandByPoint(p.set(r, i, o)), a ? (u[n * 3] = a.getX(n), u[n * 3 + 1] = a.getY(n), u[n * 3 + 2] = a.getZ(n)) : (u[n * 3] = 0, u[n * 3 + 1] = 1, u[n * 3 + 2] = 0), t ? (d[n * 3] = t.getX(n), d[n * 3 + 1] = t.getY(n), d[n * 3 + 2] = t.getZ(n)) : (d[n * 3] = .5, d[n * 3 + 1] = .7, d[n * 3 + 2] = .3);
		}
		c === 0 && f.set(new o.Vector3(0, 0, 0), new o.Vector3(0, 0, 0));
		let m = 0, h;
		if (s && s.count > 0) {
			m = Math.floor(s.count / 3), h = (c > 0 ? c - 1 : 0) > 65535 ? new Uint32Array(s.count) : new Uint16Array(s.count);
			for (let e = 0; e < s.count; e += 1) h[e] = s.getX(e);
		} else {
			m = Math.floor(c / 3), h = (c > 0 ? c - 1 : 0) > 65535 ? new Uint32Array(c) : new Uint16Array(c);
			for (let e = 0; e < c; e += 1) h[e] = e;
		}
		return {
			positions: l,
			normals: u,
			colors: d,
			indices: h,
			vertexCount: c,
			triangleCount: m,
			topTriangleCount: r.counts.topTriangles,
			surfaceVertexEnd: i.userData.miniatureSurfaceVertexEnd,
			bounds: f,
			radius: n
		};
	} finally {
		i.dispose();
	}
}
function Qd(e, t) {
	let n = t ?? e.bounds.maxHalf, r = Xd.get(e);
	r || (r = /* @__PURE__ */ new Map(), Xd.set(e, r));
	let i = r.get(n);
	return i ? r.delete(n) : i = Zd(e, n), r.set(n, i), r.size > Yd && r.delete(r.keys().next().value), i;
}
function $d(e) {
	let t = [], n = [], r = [], i = [], a = [], s = new o.Box3(), c = new o.Vector3(), l = 0, u = 0;
	for (let d = 0; d < e.length; d += 1) {
		let f = e[d], { blueprint: p, baseGeometry: m, position: h, scale: g = 1, radius: _, dimmed: v = !1, lift: y = 0 } = f, { positions: b, normals: x, colors: S, indices: C, vertexCount: w, triangleCount: T } = m ?? Qd(p, _), E = new o.Box3(), D = v ? .9 : 1, O = h.x, k = h.y + y, A = h.z;
		if (w === 0) E.set(new o.Vector3(O, k, A), new o.Vector3(O, k, A));
		else {
			for (let e = 0; e < w; e += 1) {
				let t = b[e * 3] * g + O, a = b[e * 3 + 1] * g + k, o = b[e * 3 + 2] * g + A;
				n.push(t, a, o), E.expandByPoint(c.set(t, a, o)), r.push(S[e * 3] * D, S[e * 3 + 1] * D, S[e * 3 + 2] * D), i.push(x[e * 3], x[e * 3 + 1], x[e * 3 + 2]);
			}
			s.union(E);
		}
		let j = u;
		for (let e = 0; e < C.length; e += 1) a.push(C[e] + l);
		t.push({
			id: f.id,
			islandIndex: d,
			startTriangle: j,
			triangleCount: T,
			bounds: E
		}), l += w, u += T;
	}
	let d = new o.BufferGeometry();
	return n.length > 0 ? (d.setAttribute("position", new o.Float32BufferAttribute(n, 3)), d.setAttribute("color", new o.Float32BufferAttribute(r, 3)), d.setAttribute("normal", new o.Float32BufferAttribute(i, 3)), (l > 0 ? l - 1 : 0) > 65535 ? d.setIndex(new o.Uint32BufferAttribute(new Uint32Array(a), 1)) : d.setIndex(new o.Uint16BufferAttribute(new Uint16Array(a), 1)), d.computeBoundingBox(), d.computeBoundingSphere()) : s.set(new o.Vector3(0, 0, 0), new o.Vector3(0, 0, 0)), {
		geometry: d,
		islandRanges: t,
		islandCount: e.length,
		triangleCount: u,
		bounds: s,
		islandIndexForFace(e) {
			if (typeof e != "number" || !Number.isFinite(e) || !Number.isInteger(e) || e < 0 || t.length === 0) return null;
			let n = 0, r = t.length - 1;
			for (; n <= r;) {
				let i = n + r >> 1, a = t[i];
				if (e < a.startTriangle) r = i - 1;
				else if (e >= a.startTriangle + a.triangleCount) n = i + 1;
				else return a.islandIndex;
			}
			return null;
		},
		dispose() {
			d.dispose();
		}
	};
}
//#endregion
//#region src/island/miniature-batch.ts
function ef(e) {
	let t = /* @__PURE__ */ new Map(), n = [], r = [], i = [], a = 0, s = new o.Matrix4(), c = new o.Quaternion(), l = new o.Vector3();
	try {
		for (let u of e) {
			let e = t.get(u.asset);
			e || (e = U(u.asset), t.set(u.asset, e));
			let d = e.clone();
			if (c.setFromAxisAngle(o.Object3D.DEFAULT_UP, u.rotationY), s.compose(u.position, c, l.setScalar(u.scale)), d.applyMatrix4(s), u.kind !== "accent" && (d.computeBoundingBox(), i.push({
				islandId: u.islandId,
				min: d.boundingBox.min.toArray(),
				max: d.boundingBox.max.toArray()
			})), u.dimmed) {
				let e = d.getAttribute("color");
				for (let t = 0; t < e.count; t++) e.setXYZ(t, e.getX(t) * .9, e.getY(t) * .9, e.getZ(t) * .9);
			}
			n.push(d);
			let f = (d.index?.count ?? 0) / 3;
			r.push({
				start: a,
				end: a + f,
				islandId: u.islandId
			}), a += f;
		}
		let u = n.length ? ie(n) : new o.BufferGeometry();
		if (!u) throw Error("Miniature kit must share indexed position/normal/color attributes");
		return u.userData.miniatureRanges = r, u.userData.miniatureSceneryBounds = i, n.length && (u.computeBoundingBox(), u.computeBoundingSphere()), u;
	} finally {
		n.forEach((e) => e.dispose()), t.forEach((e) => e.dispose());
	}
}
function tf() {
	return {
		positions: [],
		colors: [],
		indices: []
	};
}
function nf(e, t, n) {
	let r = e.positions.length / 3;
	return e.positions.push(t.x, t.y, t.z), e.colors.push(n.r, n.g, n.b), r;
}
function rf(e) {
	let t = new o.BufferGeometry();
	return t.setAttribute("position", new o.Float32BufferAttribute(e.positions, 3)), t.setAttribute("color", new o.Float32BufferAttribute(e.colors, 3)), t.setIndex(e.indices), t.computeVertexNormals(), e.positions.length && (t.computeBoundingBox(), t.computeBoundingSphere()), t;
}
function af(e) {
	let t = (e.radius ?? e.blueprint.bounds.maxHalf) * (e.scale ?? 1), n = e.blueprint.bounds.maxHalf;
	return {
		point: (n, r, i) => new o.Vector3(e.position.x + n * t, e.position.y + (e.lift ?? 0) + r * t, e.position.z + i * t),
		ground: (t, r) => q(e.blueprint, "world", t * n, r * n),
		m: n
	};
}
function of(e) {
	let t = tf(), n = tf(), r = new o.Color(1478060), i = new o.Color(7459283), a = new o.Color(14212526), s = new o.Color(15073279);
	for (let { island: o, pool: c } of e.water) {
		let { point: e, ground: l, m: u } = af(o), d = nf(t, e(c.x, c.y, c.z), r), f = [], p = [];
		for (let o = 0; o <= 24; o++) {
			let s = o / 24 * Math.PI * 2, m = .93 + .035 * Math.cos(s * 3) + .025 * Math.sin(s * 5), h = Math.cos(s) * c.radius * m, g = Math.sin(s) * c.radius * m, _ = c.x + h, v = c.z + g;
			f.push(nf(t, e(c.x + h * .68, c.y, c.z + g * .68), r)), p.push(nf(t, e(_, c.y, v), i));
			let y = c.x + h * 1.12, b = c.z + g * 1.12, x = l(y, b);
			if (nf(n, e(_, c.y + .002, v), a), nf(n, e(y, Math.max(x.y / u + .007, c.y - .02), b), a), o > 0) {
				t.indices.push(d, f[o], f[o - 1]), t.indices.push(f[o - 1], f[o], p[o - 1], p[o - 1], f[o], p[o]);
				let e = n.positions.length / 3 - 4;
				n.indices.push(e, e + 2, e + 1, e + 1, e + 2, e + 3);
			}
		}
		if (c.cascade) {
			let n = {
				x: .3,
				z: Math.sqrt(.91)
			}, a = [];
			for (let e = 0; e < 32; e++) {
				let t = c.radius * .8 + e * .035, r = c.x + n.x * t, i = c.z + n.z * t, o = l(r, i);
				if (!o.inside) break;
				a.push({
					x: r,
					z: i,
					y: e < 2 ? Math.max(c.y, o.y / u + .01) : o.y / u + .01
				});
			}
			let o = a.at(-1);
			if (o && a.length > 2) {
				let c = .105, l = null;
				for (let o of a) {
					let a = nf(t, e(o.x - n.z * c, o.y, o.z + n.x * c), i), s = nf(t, e(o.x + n.z * c, o.y, o.z - n.x * c), r);
					l && t.indices.push(l[0], a, l[1], l[1], a, s), l = [a, s];
				}
				for (let a = 1; a <= 10; a++) {
					let u = a / 10, d = o.x + n.x * (.035 + u * .065), f = o.z + n.z * (.035 + u * .065), p = o.y - u * .95, m = nf(t, e(d - n.z * c * (1 - u * .4), p, f + n.x * c), a > 8 ? s : i), h = nf(t, e(d + n.z * c * (1 - u * .4), p, f - n.x * c), a > 8 ? s : r);
					l && t.indices.push(l[0], m, l[1], l[1], m, h), l = [m, h];
				}
				let u = Pt(0), d = u.getAttribute("position"), f = u.getIndex();
				try {
					for (let r = 0; r < 3; r++) {
						let i = t.positions.length / 3, a = (r - 1) * .075, c = r === 1 ? .068 : .041;
						for (let i = 0; i < d.count; i++) nf(t, e(o.x + n.x * .105 + n.z * a + d.getX(i) * c, o.y - .99 - (r === 1 ? .055 : 0) + d.getY(i) * c * 1.35, o.z + n.z * .105 - n.x * a + d.getZ(i) * c), s);
						for (let e = 0; e < f.count; e++) t.indices.push(i + f.getX(e));
					}
				} finally {
					u.dispose();
				}
			}
		}
	}
	return {
		water: rf(t),
		bank: rf(n)
	};
}
//#endregion
//#region src/island/remote-props-render.tsx
var sf = (e) => (e.index?.count ?? 0) / 3;
function cf({ islands: t, onPick: r, onHover: i }) {
	let a = wc(), s = n(() => qd(t), [t]), c = n(() => {
		let e = ef(s.trees), t = ef([...s.landmarks, ...s.accents]), n = of(s), r = n.bank.index?.count && t.index?.count ? ie([t, n.bank]) : t;
		return r.userData.miniatureRanges = t.userData.miniatureRanges, r.userData.miniatureSceneryBounds = t.userData.miniatureSceneryBounds, r !== t && t.dispose(), n.bank.dispose(), {
			trees: e,
			scenery: r,
			water: n.water
		};
	}, [s, t]), l = n(() => {
		let e = { value: 0 }, t = new o.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .88,
			metalness: 0
		}), n = new o.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .82,
			metalness: 0,
			side: o.DoubleSide
		});
		return n.onBeforeCompile = (t) => {
			t.uniforms.uMiniatureTime = e, t.vertexShader = `varying vec3 vMiniaturePosition;\n${t.vertexShader}`.replace("#include <begin_vertex>", "#include <begin_vertex>\nvMiniaturePosition = position;"), t.fragmentShader = `uniform float uMiniatureTime;\nvarying vec3 vMiniaturePosition;\n${t.fragmentShader}`.replace("#include <color_fragment>", "#include <color_fragment>\n          float ripple = sin(vMiniaturePosition.y * 24.0 + vMiniaturePosition.z * 9.0 + uMiniatureTime * 2.0);\n          diffuseColor.rgb *= 1.0 + ripple * 0.055;");
		}, n.customProgramCacheKey = () => "miniature-water-v1", {
			solid: t,
			water: n,
			time: e
		};
	}, []);
	ee((e, t) => {
		!a && !ol() && (l.time.value += Math.min(.05, Math.max(0, t)));
	}), e(() => () => Object.values(c).forEach((e) => e.dispose()), [c]), e(() => () => {
		l.solid.dispose(), l.water.dispose();
	}, [l]);
	let u = Object.values(c).reduce((e, t) => e + sf(t), 0), d = (e) => {
		let n = e.object.geometry.userData.miniatureRanges, r = typeof e.faceIndex == "number" ? n?.find((t) => e.faceIndex >= t.start && e.faceIndex < t.end) : void 0;
		return r ? t.findIndex((e) => e.id === r.islandId) : -1;
	}, f = {
		onClick: (e) => {
			let t = d(e);
			t >= 0 && (e.stopPropagation(), r?.(t));
		},
		onPointerMove: (e) => {
			let t = d(e);
			t >= 0 && (e.stopPropagation(), i?.(t));
		},
		onPointerOut: () => i?.(null)
	};
	return /* @__PURE__ */ (0, z.jsxs)("group", {
		name: "remote-props",
		userData: {
			remoteProps: !0,
			remotePropCount: s.totalProps,
			remoteTreeCount: s.trees.length,
			remoteLandmarkCount: s.landmarks.length,
			remoteAccentCount: s.accents.length,
			remoteTriangleCount: u,
			miniatureStyles: t.map((e) => e.blueprint.themeSelection.recipeId)
		},
		children: [
			sf(c.trees) > 0 ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "remote-props-trees",
				geometry: c.trees,
				material: l.solid,
				...f,
				frustumCulled: !1,
				userData: {
					remoteProps: !0,
					remotePropsKind: "tree",
					remotePlacementCount: s.trees.length
				}
			}) : null,
			sf(c.scenery) > 0 ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "remote-props-landmarks",
				geometry: c.scenery,
				material: l.solid,
				...f,
				frustumCulled: !1,
				userData: {
					remoteProps: !0,
					remotePropsKind: "landmark",
					remotePlacementCount: s.landmarks.length + s.accents.length
				}
			}) : null,
			sf(c.water) > 0 ? /* @__PURE__ */ (0, z.jsx)("mesh", {
				name: "remote-props-water",
				geometry: c.water,
				material: l.water,
				frustumCulled: !1
			}) : null
		]
	});
}
//#endregion
//#region src/sky/sun.ts
var lf = {
	elevationDeg: 40,
	azimuthDeg: 210,
	keyIntensity: 5.4,
	keyColor: 16773074,
	hemisphereIntensity: .9,
	hemisphereGround: 9067333,
	ambientIntensity: .22,
	ambientColor: 11124180,
	rimIntensity: .34,
	rimColor: 10929106,
	distanceFactor: 2.65
}, uf = {
	...lf,
	elevationDeg: 50,
	azimuthDeg: 315,
	keyIntensity: 3.4
}, df = {
	...lf,
	azimuthDeg: 315,
	keyIntensity: 3.8
}, ff = Math.PI / 180;
function pf(e, t) {
	let n = e * ff, r = t * ff, i = Math.cos(n);
	return [
		Math.sin(r) * i,
		Math.sin(n),
		Math.cos(r) * i
	];
}
var mf = pf(lf.elevationDeg, lf.azimuthDeg), hf = pf(uf.elevationDeg, uf.azimuthDeg), gf = pf(df.elevationDeg, df.azimuthDeg);
function _f(e = "course") {
	return e === "catalogue" ? hf : e === "garden" ? gf : mf;
}
//#endregion
//#region src/island/miniature-shadow.ts
function vf(e, t, n, r, i) {
	if (!Number.isInteger(n) || n < 4 || t.length !== n * n || !Number.isInteger(r) || r < 0 || 2 * r >= n - 1 || !i.every(Number.isFinite) || i[1] <= .001) throw RangeError("Miniature shadows need a finite upward sun and a valid receiver raster");
	let a = new Float32Array(t.length), o = e.filter((e) => e.role !== "accent" || e.asset === "stone");
	if (!o.length) return a;
	let s = i[0] / i[1], c = i[2] / i[1], l = n - r * 2 - 1, u = Infinity, d = -Infinity, f = Infinity, p = -Infinity;
	for (let e = r; e < n - r; e++) for (let i = r; i < n - r; i++) {
		let a = t[e * n + i];
		if (!Number.isFinite(a)) continue;
		let o = (i - r) / l * 2 - 1 - s * a, m = (e - r) / l * 2 - 1 - c * a;
		u = Math.min(u, o), d = Math.max(d, o), f = Math.min(f, m), p = Math.max(p, m);
	}
	if (!Number.isFinite(u)) return a;
	u -= .04, d += .04, f -= .04, p += .04;
	let m = Math.min(256, n * 2), h = new Float32Array(m * m).fill(-Infinity), g = (e) => (e - u) / (d - u) * (m - 1), _ = (e) => (e - f) / (p - f) * (m - 1), v = /* @__PURE__ */ new Map();
	try {
		for (let e of o) {
			let t = v.get(e.asset);
			t || (t = U(e.asset), v.set(e.asset, t));
			let n = t.getAttribute("position"), r = t.index, i = new Float32Array(n.count * 3), a = Math.cos(e.turn), o = Math.sin(e.turn);
			for (let t = 0; t < n.count; t++) {
				let r = e.x + e.size * (a * n.getX(t) + o * n.getZ(t)), l = e.z + e.size * (-o * n.getX(t) + a * n.getZ(t)), u = e.y + n.getY(t) * e.size;
				i[t * 3] = g(r - s * u), i[t * 3 + 1] = u, i[t * 3 + 2] = _(l - c * u);
			}
			for (let e = 0; e < r.count; e += 3) {
				let t = r.getX(e) * 3, n = r.getX(e + 1) * 3, a = r.getX(e + 2) * 3, o = i[t], s = i[t + 2], c = i[n], l = i[n + 2], u = i[a], d = i[a + 2], f = (l - d) * (o - u) + (u - c) * (s - d);
				if (Math.abs(f) < 1e-8) continue;
				let p = Math.max(0, Math.ceil(Math.min(o, c, u))), g = Math.min(m - 1, Math.floor(Math.max(o, c, u))), _ = Math.max(0, Math.ceil(Math.min(s, l, d))), v = Math.min(m - 1, Math.floor(Math.max(s, l, d)));
				for (let e = _; e <= v; e++) for (let r = p; r <= g; r++) {
					let p = ((l - d) * (r - u) + (u - c) * (e - d)) / f, g = ((d - s) * (r - u) + (o - u) * (e - d)) / f, _ = 1 - p - g;
					if (Math.min(p, g, _) < -1e-6) continue;
					let v = p * i[t + 1] + g * i[n + 1] + _ * i[a + 1], y = e * m + r;
					h[y] = Math.max(h[y], v);
				}
			}
		}
	} finally {
		v.forEach((e) => e.dispose());
	}
	for (let e = r; e < n - r; e++) for (let i = r; i < n - r; i++) {
		let o = e * n + i, u = t[o];
		if (!Number.isFinite(u)) continue;
		let d = g((i - r) / l * 2 - 1 - s * u), f = _((e - r) / l * 2 - 1 - c * u), p = Math.floor(d), v = Math.floor(f), y = d - p, b = f - v, x = 0;
		for (let e = 0; e <= 1; e++) for (let t = 0; t <= 1; t++) (h[(v + e) * m + p + t] ?? -Infinity) > u + .004 && (x += (t ? y : 1 - y) * (e ? b : 1 - b));
		a[o] = x;
	}
	let y = new Float32Array(a.length), b = [
		1,
		4,
		6,
		4,
		1
	];
	for (let e of [!0, !1]) {
		let t = e ? a : y, r = e ? y : a;
		for (let i = 0; i < n; i++) for (let a = 0; a < n; a++) {
			let o = 0;
			for (let r = -2; r <= 2; r++) {
				let s = Math.max(0, Math.min(n - 1, a + (e ? r : 0))), c = Math.max(0, Math.min(n - 1, i + (e ? 0 : r)));
				o += t[c * n + s] * b[r + 2];
			}
			r[i * n + a] = o / 16;
		}
	}
	return a;
}
//#endregion
//#region src/island/miniature-surface-atlas.ts
var yf = {
	preferredCellSize: 128,
	maximumSide: 2048,
	padding: 8,
	colourSpace: o.LinearSRGBColorSpace,
	samplerCount: 1
}, bf = /* @__PURE__ */ new WeakMap(), xf = (e, t, n) => Math.max(t, Math.min(n, e)), Sf = (e) => 2 ** Math.ceil(Math.log2(Math.max(1, e)));
function Cf(e) {
	let t = Sf(Math.sqrt(e + 1)), n = Sf(Math.ceil((e + 1) / t)), r = Math.min(yf.preferredCellSize, Math.floor(yf.maximumSide / Math.max(t, n)));
	if (r < 4) throw RangeError("Miniature atlas exceeds its bounded catalogue capacity");
	return {
		columns: t,
		rows: n,
		cellSize: r,
		padding: Math.min(yf.padding, Math.floor(r / 4)),
		width: t * r,
		height: n * r
	};
}
function wf(e, t, n) {
	let r = new Float32Array(t * t).fill(NaN), i = t - n * 2 - 1, a = e.positions, o = e.indices, s = e.radius, c = (e) => n + (e / s + 1) * .5 * i;
	for (let i = 0; i < (e.topTriangleCount ?? 0) * 3; i += 3) {
		let e = o[i] * 3, l = o[i + 1] * 3, u = o[i + 2] * 3, d = c(a[e]), f = c(a[e + 2]), p = c(a[l]), m = c(a[l + 2]), h = c(a[u]), g = c(a[u + 2]), _ = (m - g) * (d - h) + (h - p) * (f - g);
		if (Math.abs(_) < 1e-10) continue;
		let v = Math.max(n, Math.floor(Math.min(d, p, h))), y = Math.min(t - n - 1, Math.ceil(Math.max(d, p, h))), b = Math.max(n, Math.floor(Math.min(f, m, g))), x = Math.min(t - n - 1, Math.ceil(Math.max(f, m, g)));
		for (let n = b; n <= x; n++) for (let i = v; i <= y; i++) {
			let o = ((m - g) * (i - h) + (h - p) * (n - g)) / _, c = ((g - f) * (i - h) + (d - h) * (n - g)) / _, v = 1 - o - c;
			Math.min(o, c, v) < -1e-5 || (r[n * t + i] = (o * a[e + 1] + c * a[l + 1] + v * a[u + 1]) / s);
		}
	}
	return r;
}
function Tf(e, t, n = 128, r = 8) {
	let i = bf.get(e), a = n * 100 + r, o = i?.get(a);
	if (o) return o;
	let s = new Uint8Array(n * n * 4).fill(255), c = wf(t, n, r), l = Ks(e), u = Ar(e).id === "alpine", d = n - r * 2 - 1, f = vf(l.props, c, n, r, _f("catalogue")), p = l.props.map((e) => ({
		prop: e,
		caster: e.role === "tree" || e.role === "landmark"
	}));
	for (let e = r; e < n - r; e++) for (let t = r; t < n - r; t++) {
		let i = e * n + t, a = c[i];
		if (!Number.isFinite(a)) continue;
		let o = (t - r) / d * 2 - 1, l = (e - r) / d * 2 - 1, m = xf(a / .15, 0, 1), h = .78 + m * .22, g = .86 + m * .14, _ = .7 + m * .23, v = f[i] * .43, y = 0, b = 0;
		for (let { prop: e, caster: t } of p) {
			let n = o - e.x, r = l - e.z, i = n * n + r * r, a = Math.max(.028, e.supportRadius * 1.4);
			if (i < a * a * 5 && (v = Math.max(v, Math.exp(-i / (a * a) * 2) * .16)), t) {
				let t = e.radius * 1.65;
				i < t * t * 4 && (y = Math.max(y, Math.exp(-i / (t * t))));
			}
			if (e.asset === "fence" || e.asset === "gate") {
				let t = e.radius * 1.4;
				b = Math.max(b, Math.exp(-i / (t * t) * 2) * .2);
			}
			(e.asset === "grass" || e.asset === "flowers") && i < .12 ** 2 && (y = Math.max(y, Math.exp(-i / .065 ** 2) * .65));
		}
		h = xf(h - y * .13 + b, 0, 1), g = xf(g - y * .07, 0, 1), _ = xf(_ - y * .12 - b * .3, 0, 1), u && (h = g = _ = .88 + m * .12), s[i * 4] = Math.round(h * (1 - v) * 255), s[i * 4 + 1] = Math.round(g * (1 - v * .9) * 255), s[i * 4 + 2] = Math.round(_ * (1 - v * .78) * 255);
	}
	for (let e = 0; e < 3; e++) {
		let e = s.slice();
		for (let t = 1; t < n - 1; t++) for (let r = 1; r < n - 1; r++) {
			let i = (t * n + r) * 4;
			if (s[i] === 255 && s[i + 1] === 255 && s[i + 2] === 255) {
				for (let t of [
					i - 4,
					i + 4,
					i - n * 4,
					i + n * 4
				]) if (s[t] !== 255 || s[t + 1] !== 255) {
					e.set(s.subarray(t, t + 4), i);
					break;
				}
			}
		}
		s.set(e);
	}
	return i || (i = /* @__PURE__ */ new Map(), bf.set(e, i)), i.set(a, s), s;
}
function Ef(e, t) {
	let n = performance.now(), r = [...new Set(e.map((e) => e.blueprint))], i = Cf(r.length), { width: a, height: s, columns: c, cellSize: l, padding: u } = i, d = new Uint8Array(a * s * 4).fill(255), f = new Map(r.map((e, t) => [e, t + 1])), p = /* @__PURE__ */ new Set(), m = new Float32Array((t.geometry.getAttribute("position")?.count ?? 0) * 2), h = 0;
	for (let t of e) {
		let e = t.baseGeometry ?? Qd(t.blueprint, t.radius), n = f.get(t.blueprint), r = n % c * l, i = Math.floor(n / c) * l;
		if (!p.has(t.blueprint) && e.topTriangleCount) {
			let n = Tf(t.blueprint, e, l, u);
			for (let e = 0; e < l; e++) d.set(n.subarray(e * l * 4, (e + 1) * l * 4), ((i + e) * a + r) * 4);
			p.add(t.blueprint);
		}
		for (let t = 0; t < e.vertexCount; t++) {
			let n = t < (e.surfaceVertexEnd ?? 0);
			m[(h + t) * 2] = n ? (r + u + .5 + (e.positions[t * 3] / e.radius + 1) * .5 * (l - u * 2 - 1)) / a : l * .5 / a, m[(h + t) * 2 + 1] = n ? (i + u + .5 + (e.positions[t * 3 + 2] / e.radius + 1) * .5 * (l - u * 2 - 1)) / s : l * .5 / s;
		}
		h += e.vertexCount;
	}
	t.geometry.setAttribute("uv", new o.BufferAttribute(m, 2));
	let g = new o.DataTexture(d, a, s, o.RGBAFormat);
	return g.name = "miniature-ground-colour-contact-atlas", g.colorSpace = o.LinearSRGBColorSpace, g.magFilter = o.LinearFilter, g.minFilter = o.LinearMipmapLinearFilter, g.generateMipmaps = !0, g.needsUpdate = !0, {
		texture: g,
		info: {
			...i,
			tiles: p.size,
			baseBytes: d.byteLength,
			approximateMipBytes: Math.ceil(d.byteLength * 4 / 3),
			samplers: 1,
			sunProfile: "catalogue",
			shadowDirection: _f("catalogue"),
			bakeAndUploadPreparationMs: performance.now() - n
		},
		dispose: () => g.dispose()
	};
}
//#endregion
//#region src/island/remote-island-render.tsx
function Df({ islands: t, onPick: i, onHover: a, showProps: s = !0 }) {
	let c = r(null), l = n(() => $d(t), [t]), u = n(() => s && t.length > 0 ? Ef(t, l) : null, [
		t,
		l,
		s
	]);
	e(() => () => l.dispose(), [l]), e(() => () => u?.dispose(), [u]);
	let d = n(() => new o.MeshStandardMaterial({
		vertexColors: !0,
		map: u?.texture ?? null,
		roughness: .68,
		metalness: 0
	}), [u]);
	return e(() => () => d.dispose(), [d]), t.length === 0 || l.triangleCount === 0 ? null : /* @__PURE__ */ (0, z.jsxs)("group", {
		name: "remote-island-field",
		userData: {
			remoteIslandCount: t.length,
			remoteTriangleCount: l.triangleCount,
			remoteSharedGeometry: !0,
			...u ? { surfaceAtlas: u.info } : {},
			remoteDrawModel: "one-merged-continuous-mesh"
		},
		children: [/* @__PURE__ */ (0, z.jsx)("mesh", {
			name: "remote-island-terrain",
			geometry: l.geometry,
			material: d,
			frustumCulled: !1,
			onClick: (e) => {
				let t = e.faceIndex;
				if (typeof t != "number" || !Number.isInteger(t) || t < 0) return;
				let n = l.islandIndexForFace(t);
				n !== null && (e.stopPropagation(), i?.(n));
			},
			onPointerOver: (e) => {
				let t = e.faceIndex;
				if (typeof t != "number" || !Number.isInteger(t) || t < 0) return;
				let n = l.islandIndexForFace(t);
				n !== null && n !== c.current && (c.current = n, e.stopPropagation(), a?.(n));
			},
			onPointerMove: (e) => {
				let t = e.faceIndex;
				if (typeof t != "number" || !Number.isInteger(t) || t < 0) return;
				let n = l.islandIndexForFace(t);
				n !== null && n !== c.current && (c.current = n, e.stopPropagation(), a?.(n));
			},
			onPointerOut: () => {
				c.current !== null && (c.current = null, a?.(null));
			}
		}), s ? /* @__PURE__ */ (0, z.jsx)(cf, {
			islands: t,
			onPick: i,
			onHover: a
		}) : null]
	});
}
//#endregion
//#region src/island/swiminai-island-render.tsx
function Of(e, t, n) {
	let r = t === void 0 ? 1 : t / e.bounds.maxHalf;
	return {
		id: n?.id ?? `${e.studyId}/${e.courseId}`,
		blueprint: e,
		position: new o.Vector3(),
		radius: e.bounds.maxHalf,
		scale: r,
		dimmed: n?.dimmed ?? !1
	};
}
function kf({ blueprint: e, detail: t, targetRadius: r, display: i, showDressing: a = !0, showGrass: o = !0, onClick: s, onPointerOver: c, onPointerOut: l }) {
	let u = n(() => Of(e, r, i), [
		e,
		r,
		i
	]);
	return t === "world" ? /* @__PURE__ */ (0, z.jsx)("group", {
		name: "swiminai-island-world",
		userData: {
			renderer: "@pieai/university-world/swiminai-island-render",
			detail: t,
			blueprintSeed: e.seed,
			displayId: i?.id
		},
		onClick: s ? (e) => {
			e.stopPropagation(), s();
		} : void 0,
		onPointerOver: c ? (e) => {
			e.stopPropagation(), c();
		} : void 0,
		onPointerOut: l ? (e) => {
			e.stopPropagation(), l();
		} : void 0,
		children: /* @__PURE__ */ (0, z.jsx)(Df, {
			islands: [u],
			showProps: a,
			onPick: () => s?.(),
			onHover: (e) => {
				e === null ? l?.() : c?.();
			}
		})
	}) : /* @__PURE__ */ (0, z.jsxs)("group", {
		name: "swiminai-island-course",
		userData: {
			renderer: "@pieai/university-world/swiminai-island-render",
			detail: t,
			blueprintSeed: e.seed,
			displayId: i?.id
		},
		children: [
			/* @__PURE__ */ (0, z.jsx)(Gd, {
				blueprint: e,
				detail: "course",
				targetRadius: r,
				dimmed: i?.dimmed,
				onClick: s,
				onPointerOver: c,
				onPointerOut: l
			}),
			o ? /* @__PURE__ */ (0, z.jsx)(Dd, {
				blueprint: e,
				detail: "course",
				targetRadius: r
			}) : null,
			a ? /* @__PURE__ */ (0, z.jsx)(vu, {
				blueprint: e,
				detail: "course",
				targetRadius: r
			}) : null
		]
	});
}
var Af = [
	"three",
	"react",
	"react-dom",
	"@react-three/fiber",
	"@react-three/drei",
	"@pieai/swimmer-render-kit"
], jf = {
	three: "0.185.1",
	react: "19.2.8",
	reactDom: "19.2.8",
	fiber: "9.6.1",
	drei: "10.7.8",
	swimmerRenderKit: "0.5.0"
};
//#endregion
export { jf as SWIMINAI_ISLAND_RENDER_ALIGNMENT, Af as SWIMINAI_ISLAND_RENDER_EXTERNALS, kf as SwimInAIIslandRender };

//# sourceMappingURL=swiminai-island-render.js.map