const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const categoriesRoutes = require('./routes/categories');
const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const productsRoutes = require('./routes/products');
const walletRoutes = require('./routes/wallet');
const hubnetRoutes = require('./routes/hubnet');

const { startHubnetDispatcher } = require('./lib/hubnet');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hubnet', hubnetRoutes);

app.use((err, req, res, next) => {
  void next;
  console.error(err);
  const status = err.statusCode || err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  startHubnetDispatcher();
});
