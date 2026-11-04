const supabase = require('../config/supabase');

/**
 * Register a new user
 * POST /auth/register
 */
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      message: 'Registration successful. Please check your email for verification if enabled.',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      }
    });
  } catch (err) {
    console.error('Registration Error:', err.message || err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
};

/**
 * Log in an existing user
 * POST /auth/login
 */
exports.login = async (req, res) => {
  console.log('CHECK RES:', res);
  console.log('CHECK REQ:', req);
  console.log('CHECK body:', req.body);
  console.log('CHECK Header:', req.header);

  
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Login successful',
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      }
    });
  } catch (err) {
    console.error('Login Error:', err.message || err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};

/**
 * Refresh an expired access token using a valid refresh token
 * POST /auth/refresh
 */
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session) {
      console.warn('Supabase refresh session failed:', error ? error.message : 'No session returned');
      return res.status(401).json({ error: error ? error.message : 'Invalid or expired session. Please login again.' });
    }

    return res.status(200).json({
      message: 'Token refreshed successfully',
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      }
    });
  } catch (err) {
    console.error('Refresh Token Error:', err.message || err);
    return res.status(500).json({ error: 'Server error during token refresh.' });
  }
};
