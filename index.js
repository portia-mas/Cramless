require('dotenv').config();
const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`Cramless running at http://localhost:${PORT}`);
});
