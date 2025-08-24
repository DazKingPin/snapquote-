import { createServer } from 'http';
import { readFileSync } from 'fs';
import handler from './api/index.js';

// Load environment variables from .env.local
try {
  const envLocal = readFileSync('.env.local', 'utf-8');
  envLocal.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !key.startsWith('#')) {
      process.env[key.trim()] = value.trim().replace(/"/g, '');
    }
  });
} catch (error) {
  console.log('No .env.local file found, using system environment variables');
}

const server = createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SnapQuote server running on http://localhost:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Supabase URL:', process.env.SUPABASE_URL ? 'configured' : 'not configured');
});