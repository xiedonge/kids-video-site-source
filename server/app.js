require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  // eslint-disable-line
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Kids video site running on 127.0.0.1:${PORT}`);
});
