import { InputError } from './protocol.js';

export interface RoomPassword { salt: number[]; digest: number[] }

async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100_000, salt }, key, 256);
  return new Uint8Array(bits);
}

export async function makeRoomPassword(value: unknown): Promise<RoomPassword | null> {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 96) throw new InputError('Use a password of up to 96 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: Array.from(salt), digest: Array.from(await derive(value, salt)) };
}

export async function verifyRoomPassword(saved: RoomPassword, value: unknown) {
  if (typeof value !== 'string' || value.length > 96 || !value) return false;
  const digest = await derive(value, Uint8Array.from(saved.salt));
  let difference = 0;
  for (let index = 0; index < digest.length; index++) difference |= digest[index] ^ saved.digest[index];
  return difference === 0;
}
