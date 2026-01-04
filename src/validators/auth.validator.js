const ApiError = require('../utils/ApiError');

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 12 characters, mixed case, numbers, symbols
  const minLength = password.length >= 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return { minLength, hasUpperCase, hasLowerCase, hasNumbers, hasSymbols };
};

const validateRegister = (req, res, next) => {
  const { email, password, firstName, lastName } = req.body;
  const errors = [];

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!validateEmail(email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.minLength) {
      errors.push({ field: 'password', message: 'Password must be at least 12 characters' });
    }
    if (!passwordValidation.hasUpperCase || !passwordValidation.hasLowerCase) {
      errors.push({ field: 'password', message: 'Password must contain upper and lower case letters' });
    }
    if (!passwordValidation.hasNumbers) {
      errors.push({ field: 'password', message: 'Password must contain at least one number' });
    }
    if (!passwordValidation.hasSymbols) {
      errors.push({ field: 'password', message: 'Password must contain at least one special character' });
    }
  }

  if (!firstName) {
    errors.push({ field: 'firstName', message: 'First name is required' });
  }

  if (!lastName) {
    errors.push({ field: 'lastName', message: 'Last name is required' });
  }

  if (errors.length > 0) {
    throw ApiError.badRequest('Validation failed', errors);
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  if (errors.length > 0) {
    throw ApiError.badRequest('Validation failed', errors);
  }

  next();
};

module.exports = { validateRegister, validateLogin, validateEmail, validatePassword };
