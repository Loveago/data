const { prisma } = require('../src/lib/prisma');

(async () => {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('Usage: node scripts/inspect-order.js <orderId>');
    process.exit(1);
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: { include: { category: true } } },
        },
      },
    });

    if (!order) {
      console.error('Order not found');
      process.exit(1);
    }

    const summary = {
      id: order.id,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        product: item.product?.name,
        category: item.product?.category?.slug,
        recipientPhone: item.recipientPhone,
        hubnetStatus: item.hubnetStatus,
        hubnetNetwork: item.hubnetNetwork,
        hubnetReference: item.hubnetReference,
        hubnetTransactionId: item.hubnetTransactionId,
        hubnetLastError: item.hubnetLastError,
        fulfillmentProvider: item.fulfillmentProvider,
        updatedAt: item.updatedAt,
      })),
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
