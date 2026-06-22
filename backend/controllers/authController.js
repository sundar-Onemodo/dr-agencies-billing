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
