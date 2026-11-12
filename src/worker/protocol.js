export const ROOM_ID = /^[a-f0-9]{32}$/;
const TOKEN = /^[a-f0-9]{64}$/;
export const MESSAGE_LIMIT = 2048;

export class InputError extends Error {}

export function parseMessage(message) {
  if (typeof message !== 'string' || new TextEncoder().encode(message).length > MESSAGE_LIMIT) {
    throw new InputError('Message is too large or uses an unsupported format.');
  }
  let value;
  try {
    value = JSON.parse(message);
  } catch {
    throw new InputError('Invalid message.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('Invalid message.');
  }
  return value;
}

export function displayName(name) {
  if (typeof name !== 'string') throw new InputError('Enter a display name.');
  const normalized = name.trim().normalize('NFC');
  if (!normalized || normalized.length > 32 || /[\p{Cc}\p{Cf}]/u.test(normalized)) {
    throw new InputError('Use a display name of 1 to 32 characters.');
  }
  return normalized;
}

export async function tokenHash(token) {
  if (typeof token !== 'string' || !TOKEN.test(token)) {
    throw new InputError('Invalid player credential.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function requestMessage(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new InputError('Send a JSON request.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Missing request body.');
  const buffer = new Uint8Array(MESSAGE_LIMIT);
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.byteLength > buffer.length) {
      await reader.cancel();
      throw new InputError('Request is too large.');
    }
    buffer.set(value, offset);
    offset += value.byteLength;
  }
  return parseMessage(new TextDecoder().decode(buffer.subarray(0, offset)));
}
