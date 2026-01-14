const dotenv = require('dotenv');
const { Prisma, PrismaClient } = require('@prisma/client');

dotenv.config();

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const prisma = new PrismaClient();

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!';

  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: 'ADMIN',
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      name: 'Admin',
    },
  });

  const categoriesToEnsure = [
    { name: 'MTN', slug: 'mtn' },
    { name: 'Telecel', slug: 'telecel' },
    { name: 'AT iShare', slug: 'airteltigo' },
    { name: 'AT BigTime', slug: 'at-bigtime' },
    { name: 'Subscription', slug: 'subscription' },
  ];

  const categoriesBySlug = {};
  for (const c of categoriesToEnsure) {
    const upserted = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { name: c.name, slug: c.slug },
    });

    categoriesBySlug[c.slug] = upserted;
  }

  await prisma.product.deleteMany({
    where: {
      OR: [{ slug: 'mtn-92gb' }, { slug: 'mtn-92-gb' }],
    },
  });

  await prisma.product.deleteMany({
    where: {
      slug: { in: ['telecel-1gb', 'telecel-2gb', 'telecel-3gb'] },
    },
  });

  await prisma.product.deleteMany({
    where: {
      OR: [
        { slug: { in: ['at-bigtime-20gb'] } },
        { name: { contains: 'BigTime 20GB', mode: 'insensitive' } },
      ],
    },
  });

  const bundles = [
    { networkSlug: 'mtn', networkName: 'MTN', size: '1GB', price: '4.50' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '2GB', price: '9.00' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '3GB', price: '13.60' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '4GB', price: '17.90' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '5GB', price: '22.70' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '6GB', price: '27.30' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '8GB', price: '36.10' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '10GB', price: '42.00' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '15GB', price: '62.20' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '20GB', price: '82.30' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '25GB', price: '103.10' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '30GB', price: '122.70' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '40GB', price: '161.30' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '50GB', price: '197.00' },
    { networkSlug: 'mtn', networkName: 'MTN', size: '100GB', price: '375.00' },

    { networkSlug: 'telecel', networkName: 'Telecel', size: '5GB', price: '23.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '10GB', price: '40.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '15GB', price: '60.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '20GB', price: '79.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '25GB', price: '95.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '30GB', price: '115.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '40GB', price: '150.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '50GB', price: '185.00' },
    { networkSlug: 'telecel', networkName: 'Telecel', size: '100GB', price: '360.00' },

    { networkSlug: 'at-bigtime', networkName: 'AT - BigTime', size: '30GB', price: '80.00' },
    { networkSlug: 'at-bigtime', networkName: 'AT - BigTime', size: '40GB', price: '90.00' },
    { networkSlug: 'at-bigtime', networkName: 'AT - BigTime', size: '50GB', price: '105.00' },
    { networkSlug: 'at-bigtime', networkName: 'AT - BigTime', size: '100GB', price: '190.00' },
    { networkSlug: 'at-bigtime', networkName: 'AT - BigTime', size: '200GB', price: '350.00' },

    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '1GB', price: '4.30' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '2GB', price: '8.30' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '3GB', price: '12.30' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '4GB', price: '16.40' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '5GB', price: '20.50' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '6GB', price: '24.50' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '7GB', price: '28.30' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '8GB', price: '33.00' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '10GB', price: '40.00' },
    { networkSlug: 'airteltigo', networkName: 'AT - iShare', size: '15GB', price: '60.00' },
  ];

  for (const bundle of bundles) {
    const category = categoriesBySlug[bundle.networkSlug];
    if (!category) continue;

    const slug = slugify(`${bundle.networkSlug}-${bundle.size}`);
    const name = `${bundle.networkName} ${bundle.size} Data Bundle`;

    await prisma.product.upsert({
      where: { slug },
      update: {
        name,
        description: `${bundle.networkName} ${bundle.size} data bundle.`,
        price: new Prisma.Decimal(String(bundle.price)),
        stock: 999,
        imageUrls: [`https://via.placeholder.com/800x600.png?text=${encodeURIComponent(`${bundle.networkName}+${bundle.size}`)}`],
        categoryId: category.id,
      },
      create: {
        name,
        slug,
        description: `${bundle.networkName} ${bundle.size} data bundle.`,
        price: new Prisma.Decimal(String(bundle.price)),
        stock: 999,
        imageUrls: [`https://via.placeholder.com/800x600.png?text=${encodeURIComponent(`${bundle.networkName}+${bundle.size}`)}`],
        categoryId: category.id,
      },
    });
  }

  await prisma.$disconnect();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
