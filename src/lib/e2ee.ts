// End-to-end encryption helpers using Web Crypto (RSA-OAEP 2048 + AES-GCM 256).
// Private key never leaves the device (stored in localStorage as JWK).
// Public key is published to profiles.public_key as JWK string.
import { supabase } from "@/integrations/supabase/client";

const PRIV_KEY = (uid: string) => `e2ee:priv:${uid}`;
const PUB_KEY = (uid: string) => `e2ee:pub:${uid}`;

const RSA_ALG: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const b64 = {
  enc: (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  },
  dec: (s: string) => {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

const pubCache = new Map<string, CryptoKey>();
let privCache: { uid: string; key: CryptoKey } | null = null;

async function importPub(jwkStr: string) {
  const jwk = JSON.parse(jwkStr);
  return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}
async function importPriv(jwkStr: string) {
  const jwk = JSON.parse(jwkStr);
  return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}

export async function ensureKeypair(userId: string): Promise<string> {
  const existingPub = localStorage.getItem(PUB_KEY(userId));
  const existingPriv = localStorage.getItem(PRIV_KEY(userId));
  if (existingPub && existingPriv) {
    // Make sure server has it
    const { data } = await supabase.from("profiles").select("public_key").eq("id", userId).maybeSingle();
    if (!data?.public_key) {
      await supabase.from("profiles").update({ public_key: existingPub }).eq("id", userId);
    }
    return existingPub;
  }
  const pair = await crypto.subtle.generateKey(RSA_ALG, true, ["encrypt", "decrypt"]);
  const pubJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const privJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
  localStorage.setItem(PUB_KEY(userId), pubJwk);
  localStorage.setItem(PRIV_KEY(userId), privJwk);
  await supabase.from("profiles").update({ public_key: pubJwk }).eq("id", userId);
  return pubJwk;
}

async function getMyPriv(userId: string): Promise<CryptoKey | null> {
  if (privCache?.uid === userId) return privCache.key;
  const jwk = localStorage.getItem(PRIV_KEY(userId));
  if (!jwk) return null;
  const key = await importPriv(jwk);
  privCache = { uid: userId, key };
  return key;
}

async function getRecipientPub(userId: string): Promise<CryptoKey | null> {
  if (pubCache.has(userId)) return pubCache.get(userId)!;
  const { data } = await supabase.from("profiles").select("public_key").eq("id", userId).maybeSingle();
  if (!data?.public_key) return null;
  const key = await importPub(data.public_key);
  pubCache.set(userId, key);
  return key;
}

export type EncryptedPayload = {
  ciphertext: string; // base64
  iv: string; // base64
  encrypted_keys: Record<string, string>; // userId -> base64(RSA(aesKeyRaw))
};

export async function encryptForRecipients(plaintext: string, recipientIds: string[]): Promise<EncryptedPayload | null> {
  // Fetch all recipient public keys; if any missing, abort (caller falls back to plaintext)
  const pubs: Record<string, CryptoKey> = {};
  for (const uid of recipientIds) {
    const k = await getRecipientPub(uid);
    if (!k) return null;
    pubs[uid] = k;
  }
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext));
  const aesRaw = await crypto.subtle.exportKey("raw", aesKey);
  const encrypted_keys: Record<string, string> = {};
  for (const uid of recipientIds) {
    const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubs[uid], aesRaw);
    encrypted_keys[uid] = b64.enc(wrapped);
  }
  return { ciphertext: b64.enc(ctBuf), iv: b64.enc(iv), encrypted_keys };
}

export async function decryptMessage(
  myUserId: string,
  ciphertextB64: string,
  ivB64: string,
  encryptedKeys: Record<string, string>,
): Promise<string | null> {
  try {
    const wrapped = encryptedKeys?.[myUserId];
    if (!wrapped) return null;
    const priv = await getMyPriv(myUserId);
    if (!priv) return null;
    const aesRaw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64.dec(wrapped));
    const aesKey = await crypto.subtle.importKey("raw", aesRaw, { name: "AES-GCM" }, false, ["decrypt"]);
    const ptBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64.dec(ivB64) },
      aesKey,
      b64.dec(ciphertextB64),
    );
    return new TextDecoder().decode(ptBuf);
  } catch (e) {
    console.warn("decrypt failed", e);
    return null;
  }
}

export function hasPrivateKey(userId: string) {
  return !!localStorage.getItem(PRIV_KEY(userId));
}
