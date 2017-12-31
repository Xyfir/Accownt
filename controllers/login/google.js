const createAccount = require('lib/users/create');
const GoogleAuth = require('google-auth-library');
const request = require('superagent');
const mysql = require('lib/mysql');
const auth = new GoogleAuth;

const config = require('config');

/*
  POST api/login/google
  REQUIRED
    idToken: string
  RETURN
    { error: bool, message?: string }
  DESCRIPTION
    Login or register a Xyfir Account using a Google account
*/
module.exports = async function(req, res) {

  const client = new auth.OAuth2(config.keys.googleClientId, '', '');
  const db = new mysql;

  try {
    const user = await new Promise((resolve, reject) => {
      client.verifyIdToken(
        req.body.idToken, config.keys.googleClientId,
        (err, g) => err ? reject(err) : resolve(g.getPayload())
      );
    });

    if (!user.email_verified)
      throw 'You must verify your email with Google';

    await db.getConnection();

    // Get all rows in `users` table with user's email
    let sql = `
      SELECT
        id, verified, google
      FROM users WHERE email = ?
    `,
    vars = [
      user.email
    ],
    rows = await db.query(sql, vars);

    rows.forEach(row => {
      if (row.verified && !row.google)
        throw 'Email is already linked to a normal Xyfir Account';
      else if (row.google)
        req.session.uid = row.id;
    });

    // Users can no longer create accounts via Google
    if (!req.session.uid) {
      throw 'Sorry! ' +
        'Google Sign-In is no longer supported for new accounts. ' +
        'You must create an account using your email instead.';
    }

    db.release();

    res.json({
      error: false, redirect: (
        req.session.redirect ? req.session.redirect : ''
      )
    });
    req.session.redirect = '';
  }
  catch (err) {
    db.release();
    res.json({ error: true, message: err });
  }

}