const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '>> ACCESS_DENIED: Authentication required'
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: '>> ACCESS_DENIED: User not found'
      });
    }
    
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: '>> ACCESS_DENIED: Invalid or expired token'
    });
  }
};

module.exports = authMiddleware;
