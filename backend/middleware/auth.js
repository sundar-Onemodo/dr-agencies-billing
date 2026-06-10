const supabase = require('../config/supabase');

/**
 * Express middleware to authenticate and authorize requests using Supabase JWT.
 * Expects Bearer token in the 'Authorization' header.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please authenticate.' });
  }

  try {
    // Call Supabase auth.getUser() to verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid, expired, or revoked access token.' });
    }

    // Attach user information to request object
    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication Middleware Error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authenticateToken;
