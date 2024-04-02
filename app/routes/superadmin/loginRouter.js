const express = require('express');

const loginRouter = new express.Router();
const loginController = require('../../controllers/superadmin/loginController');

// RENDER

loginRouter.post('/login', (req, res) => {
  loginController.login(req, res);
});

loginRouter.use((req, res, next) => {
  if (req.user.role === 'superadmin') {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});

loginRouter.get('/logout', (req, res) => {
  loginController.logout(req, res);
});

module.exports = loginRouter;
