// zaloha_format.js — formát šifrovanej zálohy eživnostníka (ESM).
//
// Jedno miesto pre balenie a šifrovanie zálohy. Používa ho admin.html pri
// stiahnutí zálohy (Roman 21. 9. 2026: záloha z adminu s opätovným overením
// druhým faktorom) a dev/zaloha/zaloha.js pri overení a obnove. Dve kópie
// formátu by sa rozišli a záloha by sa nedala otvoriť práve vtedy, keď treba.
//
// Len Web Crypto (prehliadač aj Node 24 ho majú ako globalThis.crypto) —
// preto PBKDF2-SHA256, nie scrypt, ktorý Web Crypto nemá.
//
// Súbor:  "EZZALOHA1\n" | dĺžka hlavičky (4 B, BE) | hlavička JSON | šifra
//   hlavička: { kdf:"pbkdf2-sha256", iteracie, sol, iv } — nič tajné
//   šifra:    AES-256-GCM (značka 16 B na konci, ako ju vracia Web Crypto)
// Obsah:  dĺžka súpisu (4 B, BE) | súpis JSON | dáta položiek za sebou
//   súpis:    { ...info, polozky:[{ typ, nazov, posun, dlzka, sha256, ... }] }

export const MAGIA = "EZZALOHA1";
export const ITERACIE = 600000;
export const MIN_HESLO = 16;
// Originály e-faktúr — zálohujú sa aj zvlášť a držia 10 rokov (zásady).
export const JE_EFAKTURA = /(^|\/)efaktura_[^/]*\.xml$/;

const kod = new TextEncoder(), dekod = new TextDecoder();
const c = () => globalThis.crypto;

function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; }
function citajU32(b, o) { return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(o); }
function spoj(casti) {
  const n = casti.reduce((s, x) => s + x.length, 0), v = new Uint8Array(n);
  let o = 0; for (const x of casti) { v.set(x, o); o += x.length; }
  return v;
}
function b64(b) { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); }
function zB64(s) { return Uint8Array.from(atob(s), ch => ch.charCodeAt(0)); }

export async function sha256(data) {
  const h = new Uint8Array(await c().subtle.digest("SHA-256", data));
  return [...h].map(x => x.toString(16).padStart(2, "0")).join("");
}

// polozky: [{ typ, nazov, data: Uint8Array, extra? }]
export async function zabal(polozky, info = {}) {
  let posun = 0;
  const zoznam = [];
  for (const p of polozky) {
    zoznam.push({ typ: p.typ, nazov: p.nazov, posun, dlzka: p.data.length, sha256: await sha256(p.data), ...(p.extra || {}) });
    posun += p.data.length;
  }
  const s = kod.encode(JSON.stringify({ ...info, polozky: zoznam }));
  return spoj([u32(s.length), s, ...polozky.map(p => p.data)]);
}

export function rozbal(obsah) {
  const n = citajU32(obsah, 0);
  const supis = JSON.parse(dekod.decode(obsah.subarray(4, 4 + n)));
  const z = 4 + n;
  return { supis, polozky: supis.polozky.map(p => ({ ...p, data: obsah.subarray(z + p.posun, z + p.posun + p.dlzka) })) };
}

async function kluc(heslo, sol, iteracie, pouzitie) {
  const zaklad = await c().subtle.importKey("raw", kod.encode(heslo), "PBKDF2", false, ["deriveKey"]);
  return c().subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sol, iterations: iteracie },
    zaklad, { name: "AES-GCM", length: 256 }, false, [pouzitie]);
}

export async function zasifruj(obsah, heslo) {
  if (String(heslo || "").length < MIN_HESLO) throw new Error("heslo zálohy musí mať aspoň " + MIN_HESLO + " znakov");
  const sol = c().getRandomValues(new Uint8Array(16)), iv = c().getRandomValues(new Uint8Array(12));
  const sifra = new Uint8Array(await c().subtle.encrypt({ name: "AES-GCM", iv }, await kluc(heslo, sol, ITERACIE, "encrypt"), obsah));
  const hl = kod.encode(JSON.stringify({ kdf: "pbkdf2-sha256", iteracie: ITERACIE, sol: b64(sol), iv: b64(iv) }));
  return spoj([kod.encode(MAGIA + "\n"), u32(hl.length), hl, sifra]);
}

export async function odsifruj(subor, heslo) {
  const m = kod.encode(MAGIA + "\n");
  if (subor.length < m.length + 4 || !m.every((x, i) => subor[i] === x))
    throw new Error("toto nie je záloha eživnostníka (chýba značka " + MAGIA + ")");
  const n = citajU32(subor, m.length);
  const hl = JSON.parse(dekod.decode(subor.subarray(m.length + 4, m.length + 4 + n)));
  if (hl.kdf !== "pbkdf2-sha256") throw new Error("neznámy spôsob odvodenia kľúča: " + hl.kdf);
  try {
    const k = await kluc(heslo, zB64(hl.sol), hl.iteracie, "decrypt");
    return new Uint8Array(await c().subtle.decrypt({ name: "AES-GCM", iv: zB64(hl.iv) }, k, subor.subarray(m.length + 4 + n)));
  } catch (_) {
    throw new Error("zálohu sa nepodarilo otvoriť — nesprávne heslo alebo poškodený súbor");
  }
}

// Otvorí zálohu a overí KAŽDÚ položku proti súpisu (dĺžka, SHA-256, počet
// riadkov tabuľky). Chyby vracia v zozname — prázdny zoznam = záloha je celá.
export async function over(subor, heslo) {
  const { supis, polozky } = rozbal(await odsifruj(subor, heslo));
  const chyby = [];
  for (const p of polozky) {
    if (p.data.length !== p.dlzka) { chyby.push(p.nazov + ": dĺžka " + p.data.length + " namiesto " + p.dlzka); continue; }
    if (await sha256(p.data) !== p.sha256) { chyby.push(p.nazov + ": odtlačok nesedí"); continue; }
    if (p.typ === "tabulka") {
      const riadky = JSON.parse(dekod.decode(p.data));
      if (riadky.length !== p.riadkov) chyby.push(p.nazov + ": " + riadky.length + " riadkov namiesto " + p.riadkov);
    }
  }
  return { supis, polozky, chyby };
}

export function menoZalohy(druh, d) { return "ezivnostnik-" + druh + "-" + d.toISOString().slice(0, 10) + ".ezz"; }
