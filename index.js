const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// === SECURE: USING ENVIRONMENT VARIABLES ===
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://bss-verifier.vercel.app/api/auth/callback';
const CHANNEL_IDS = process.env.CHANNEL_IDS ? process.env.CHANNEL_IDS.split(',') : ['UC6BEZkC4__0eAhXfVU2kfeg', 'UCVt0DAgK85pgbSfexfbh4jQ'];
const SUCCESS_URL = process.env.SUCCESS_URL || 'https://bangsmackskeet.com/success';
const FAIL_URL = process.env.FAIL_URL || 'https://bangsmackskeet.com/not-subscribed';

// Validate required environment variables
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

app.get('/api/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.readonly'],
    prompt: 'consent'
  });
  res.redirect(authUrl);
});

app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(FAIL_URL + '?error=no_code');
    }
    
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const response = await youtube.subscriptions.list({ 
      part: 'snippet', 
      mine: true,
      maxResults: 50
    });

    const userSubs = response.data.items.map(item => item.snippet.resourceId.channelId);
    const isVerified = CHANNEL_IDS.every(id => userSubs.includes(id));
    
    if (isVerified) {
      const trialId = `bss_${Date.now()}`;
      const trialLink = `https://onlyfans.com/yourpage?trial=${trialId}`;
      res.redirect(SUCCESS_URL + '?trial=' + encodeURIComponent(trialLink));
    } else {
      res.redirect(FAIL_URL + '?error=not_subscribed');
    }
  } catch (error) {
    console.error('Error:', error);
    res.redirect(FAIL_URL + '?error=auth_failed');
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'BSS Verifier is running' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`BSS Verifier running on port ${port}`);
});

module.exports = app;