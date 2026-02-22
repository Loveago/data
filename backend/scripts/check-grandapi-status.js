const { grandapiCheckStatus } = require('../src/lib/grandapi');

(async () => {
  const reference = process.argv[2];
  if (!reference) {
    console.error('Usage: node scripts/check-grandapi-status.js <orderId>');
    process.exit(1);
  }

  try {
    const res = await grandapiCheckStatus(reference);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
