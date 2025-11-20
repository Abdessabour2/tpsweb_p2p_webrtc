// sessions.js
const crypto = require('crypto');
const sessions = new Map(); // sid -> { login, createdAt }

function create(login) {
    const sid = crypto.randomUUID();
    sessions.set(sid, { login, createdAt: Date.now() });
    return sid;
}
function get(sid)     { return sessions.get(sid); }
function destroy(sid) { sessions.delete(sid);     }

module.exports = { create, get, destroy };
