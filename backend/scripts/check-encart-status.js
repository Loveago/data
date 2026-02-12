const { encartCheckStatus } = require('../src/lib/encart');

(async () => {
  const reference = process.argv[2];
  if (!reference) {
    console.error('Usage: node scripts/check-encart-status.js <reference>');
    process.exit(1);
  }

  try {
    const res = await encartCheckStatus(reference);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
