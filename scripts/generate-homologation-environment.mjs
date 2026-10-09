import { writeFile } from 'node:fs/promises';

// These two values are public and will be included in the browser bundle.
// Keep administrative credentials outside this process and the frontend.
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabasePublicKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY para o build de homologação.');
}

const url = new URL(supabaseUrl);
if (
  url.origin !== 'https://cpjorwbvbzqopiwwwqdy.supabase.co' ||
  url.username || url.password || url.search || url.hash || url.pathname !== '/'
) {
  throw new Error('A homologação deve usar somente a URL HTTPS do projeto vittahub-dev.');
}

if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(supabasePublicKey)) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY deve ser uma chave pública sb_publishable_.');
}

const environment = { supabaseUrl: url.origin, supabasePublicKey };
await writeFile(
  new URL('../src/environments/environment.production.local.ts', import.meta.url),
  '// Generated for homologation. Public values only; ignored by Git.\n' +
    `export const environment = ${JSON.stringify(environment, null, 2)};\n`,
);
console.log('Configuração pública de homologação gerada para vittahub-dev.');
