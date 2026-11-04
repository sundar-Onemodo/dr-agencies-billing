const supabase = require('../config/supabase');

/**
 * Express middleware to authenticate and authorize requests using Supabase JWT.
 * Expects Bearer token in the 'Authorization' header.
 * Supports auto-refreshing expired access tokens if 'x-refresh-token' is provided.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please authenticate.' });
  }

  try {
    // 1. Verify the access token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = user;
      return next();
    }

    // 2. If access token is expired or invalid, attempt seamless refresh using refresh_token
    if (refreshToken) {
      try {
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession({
          refresh_token: refreshToken
        });

        if (!refreshErr && refreshData?.session && refreshData?.user) {
          req.user = refreshData.user;
          // Return new tokens in response headers so the client can update its storage
          res.setHeader('x-new-token', refreshData.session.access_token);
          res.setHeader('x-new-refresh-token', refreshData.session.refresh_token);
          res.setHeader('Access-Control-Expose-Headers', 'x-new-token, x-new-refresh-token');
          return next();
        }
      } catch (rErr) {
        console.warn('Auto token refresh attempt failed:', rErr.message || rErr);
      }
    }

    return res.status(401).json({ error: 'Invalid, expired, or revoked access token.' });
  } catch (err) {
    console.error('Authentication Middleware Error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authenticateToken;
