// users.js
const crypto = require('crypto');
const users = new Map(); // login -> { nom, prenom, login, passwordHash, salt, lastImagePath }

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
    return { salt, hash };
}
function createUser({ nom, prenom, login, password }) {
    if (users.has(login)) throw new Error('EXISTS');
    const { salt, hash: passwordHash } = hash(password);
    users.set(login, { nom, prenom, login, passwordHash, salt, lastImagePath: null });
}
function verify(login, password) {
    const u = users.get(login); if (!u) return false;
    const { hash: h } = hash(password, u.salt);
    return h === u.passwordHash ? u : false;
}
function get(login) { return users.get(login); }
function setImage(login, filePath) {
    const u = users.get(login); if (u) u.lastImagePath = filePath;
}
module.exports = { createUser, verify, get, setImage };
