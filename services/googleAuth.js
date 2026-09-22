const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, '..', 'data', 'tokens.json');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const oAuth2Client = getOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

async function exchangeCodeForTokens(code) {
  const oAuth2Client = getOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

function hasStoredTokens() {
  return fs.existsSync(TOKEN_PATH);
}

async function getAuthorizedClient() {
  if (!hasStoredTokens()) {
    throw new Error('Not authenticated. Visit /auth/google to connect your calendar.');
  }
  const oAuth2Client = getOAuthClient();
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oAuth2Client.setCredentials(tokens);

  // Persist refreshed tokens automatically when the library rotates them
  oAuth2Client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });

  return oAuth2Client;
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  hasStoredTokens,
  getAuthorizedClient,
};
