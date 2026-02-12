(async () => {
  const { prisma } = require('../src/lib/prisma');

  try {
    const product = await prisma.product.findFirst({ where: { slug: 'mtn-1gb' } });
    console.log(product);
  } finally {
    await prisma.$disconnect();
  }
})();
