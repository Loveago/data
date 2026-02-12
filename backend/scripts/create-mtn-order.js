const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/lib/prisma');
const { queueFulfillmentForOrder } = require('../src/lib/fulfillment');

function generateOrderCode() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `GH-${yyyy}${mm}${dd}-${rand}`;
}

(async () => {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    if (!user) throw new Error('Seed admin user not found');

    const product = await prisma.product.findUnique({ where: { slug: 'mtn-1gb' } });
    if (!product) throw new Error('MTN 1GB product not found');

    const unitPrice = product.price;
    const quantity = 1;
    const lineTotal = unitPrice.mul(new Prisma.Decimal(quantity));

    await prisma.product.update({
      where: { id: product.id },
      data: { stock: { decrement: quantity } },
    });

    const order = await prisma.order.create({
      data: {
        orderCode: generateOrderCode(),
        userId: user.id,
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerPhone: '0500000000',
        customerAddress: 'Test Address',
        subtotal: lineTotal,
        total: lineTotal,
        paymentProvider: 'wallet',
        paymentReference: 'manual-test',
        paymentStatus: 'PAID',
        items: {
          create: {
            productId: product.id,
            quantity,
            recipientPhone: '0257467983',
            unitPrice,
            lineTotal,
          },
        },
      },
      include: { items: { include: { product: { include: { category: true } } } } },
    });

    console.log('Created order', order.id, order.orderCode);

    const result = await queueFulfillmentForOrder(order.id);
    console.log('Queue result:', result);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
