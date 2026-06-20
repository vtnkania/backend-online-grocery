import 'dotenv/config';

export const PORT = Number(process.env.PORT) || 3000;
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
const localOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? Array.from(new Set([...process.env.ALLOWED_ORIGINS.split(','), ...localOrigins]))
  : '*';
export const API_PREFIX = '/api/v1';

// DAFTARKAN DUA VARIABEL EXPORT BARU INI UNTUK MIDTRANS
export const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY ?? '';
export const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? '';
