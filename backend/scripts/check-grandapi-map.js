const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const raw = process.env.GRANDAPI_NETWORK_MAP || '';
try {
  const parsed = JSON.parse(raw || '{}');
  const keys = Object.keys(parsed || {});
  console.log('GRANDAPI_NETWORK_MAP valid. Keys:', keys);
} catch (err) {
  console.error('GRANDAPI_NETWORK_MAP invalid:', err.message);
  process.exit(1);
}
