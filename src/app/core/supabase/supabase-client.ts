import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

export function createSupabaseClient(): SupabaseClient {
  const url = environment.supabaseUrl.trim();
  const publicKey = environment.supabasePublicKey.trim();

  if (!url || !publicKey) {
    throw new Error('Supabase não configurado: preencha supabaseUrl e supabasePublicKey no ambiente.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Supabase: supabaseUrl deve ser uma URL HTTP ou HTTPS válida.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('Supabase: supabaseUrl deve usar HTTP ou HTTPS e não conter credenciais.');
  }

  if (!isPublicKey(publicKey)) {
    throw new Error('Supabase: utilize somente uma chave pública publishable ou anon.');
  }

  return createClient(url, publicKey);
}

function isPublicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    return true;
  }

  // Checks the legacy key's role to catch accidental privileged keys;
  // signature verification and authorization remain the server's responsibility.
  try {
    const parts = key.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof claims === 'object' && claims !== null && 'role' in claims && claims.role === 'anon';
  } catch {
    return false;
  }
}
