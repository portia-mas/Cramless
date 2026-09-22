const express = require('express');
const router = express.Router();
const { getAuthUrl, exchangeCodeForTokens, hasStoredTokens } = require('../services/googleAuth');

router.get('/google', (req, res) => {
  res.redirect(getAuthUrl());
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code.');

  try {
    await exchangeCodeForTokens(code);
    res.redirect('/?connected=1');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).send('Failed to connect Google Calendar. Check server logs.');
  }
});

router.get('/status', (req, res) => {
  res.json({ connected: hasStoredTokens() });
});

module.exports = router;
