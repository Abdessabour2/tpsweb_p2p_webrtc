// requestHandlers.js
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const sessions = require('./sessions');
const users = require('./users');

const ROOT = __dirname;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Assurer l'existence des dossiers
for (const d of [UPLOAD_DIR, PUBLIC_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function parseCookies(req) {
    const rc = req.headers.cookie || '';
    const out = {};
    rc.split(';').forEach(c => {
        const i = c.indexOf('=');
        if (i > -1) out[decodeURIComponent(c.slice(0, i).trim())] =
            decodeURIComponent(c.slice(i + 1).trim());
    });
    return out;
}
function sendJSON(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
}
function sendHTML(res, code, html) {
    res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}
function sendText(res, code, text) {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}
function parseBody(req, body) {
    const ct = (req.headers['content-type'] || '').split(';')[0].trim();
    if (ct === 'application/json') return JSON.parse(body || '{}');
    // x-www-form-urlencoded
    return Object.fromEntries(new URLSearchParams(body || ''));
}
function currentUser(req) {
    const sid = parseCookies(req).SID;
    if (!sid) return null;
    const s = sessions.get(sid);
    return s ? users.get(s.login) : null;
}
function start(req, res) {
    const me = currentUser(req);
    const header = `<h1>TP Node.js — P2P Web</h1>`;

    const notLogged = `
    <h2>Inscription</h2>
    <form method="POST" action="/register">
      <input name="nom" placeholder="Nom" required>
      <input name="prenom" placeholder="Prénom" required>
      <input name="login" placeholder="Login" required>
      <input type="password" name="password" placeholder="Mot de passe" required>
      <button>S'inscrire</button>
    </form>
    <h2>Connexion</h2>
    <form method="POST" action="/login">
      <input name="login" placeholder="Login" required>
      <input type="password" name="password" placeholder="Mot de passe" required>
      <button>Se connecter</button>
    </form>
    <p>Services: <a href="/find">find</a> (nécessite login), <a href="/show">show</a> (image par défaut)</p>
  `;

    let body = notLogged;
    if (me) {
        const logged = `
      <p>Bonjour <b>${me.prenom} ${me.nom}</b> (<code>${me.login}</code>) —
         <a href="/logout">Logout</a></p>
      <h2>Upload image de profil</h2>
      <form method="POST" action="/upload" enctype="multipart/form-data">
        <input type="file" name="photo" accept="image/*" required>
        <button>Uploader</button>
      </form>
      <p><a href="/show">Afficher ma dernière image</a> • <a href="/find?dir=uploads">Lister /uploads</a></p>
    `;
        body = logged;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(header + body);
}



async function register(req, res) {
    if (req.method !== 'POST') return sendText(res, 405, 'Use POST');
    try {
        const data = parseBody(req, await readBody(req));
        const { nom, prenom, login, password } = data;
        if (!nom || !prenom || !login || !password) return sendJSON(res, 400, { error: 'Champs manquants' });
        try {
            users.createUser({ nom, prenom, login, password });
            sendJSON(res, 201, { ok: true, login });
        } catch (e) {
            if (e.message === 'EXISTS') return sendJSON(res, 409, { error: 'Login déjà utilisé' });
            sendJSON(res, 500, { error: 'Erreur serveur' });
        }
    } catch {
        sendJSON(res, 400, { error: 'Corps invalide' });
    }
}

async function login(req, res) {
    if (req.method !== 'POST') return sendText(res, 405, 'Use POST');
    try {
        const data = parseBody(req, await readBody(req));
        const u = users.verify(data.login, data.password);
        if (!u) return sendJSON(res, 401, { error: 'Identifiants invalides' });
        const sid = sessions.create(u.login);
        res.writeHead(200, {
            'Set-Cookie': `SID=${sid}; HttpOnly; Path=/; SameSite=Lax`,
            'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(JSON.stringify({ ok: true, login: u.login }));
    } catch {
        sendJSON(res, 400, { error: 'Corps invalide' });
    }
}

function logout(req, res) {
    const sid = parseCookies(req).SID;
    if (sid) sessions.destroy(sid);
    res.writeHead(200, {
        'Set-Cookie': `SID=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`,
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify({ ok: true }));
}

function upload(req, res) {
    const me = currentUser(req);
    if (!me) return sendJSON(res, 401, { error: 'Non connecté' });

    if (req.method !== 'POST') {
        return sendHTML(res, 200,
            `<form method="POST" action="/upload" enctype="multipart/form-data">
         <input type="file" name="photo" accept="image/*" required>
         <button>Uploader</button>
       </form>`);
    }
    const form = formidable({ uploadDir: UPLOAD_DIR, keepExtensions: true, maxFileSize: 5 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
        if (err) return sendJSON(res, 400, { error: 'Erreur upload' });
        const f = Array.isArray(files.photo) ? files.photo[0] : files.photo;
        if (!f) return sendJSON(res, 400, { error: 'Aucun fichier' });

        const ext = path.extname(f.originalFilename || f.filepath).toLowerCase();
        const finalPath = path.join(UPLOAD_DIR, `${me.login}${ext || ''}`);
        fs.rename(f.filepath, finalPath, (e) => {
            if (e) return sendJSON(res, 500, { error: 'Impossible de sauvegarder' });
            users.setImage(me.login, finalPath);
            sendJSON(res, 200, { ok: true, show: '/show' });
        });
    });
}

function show(req, res) {
    const me = currentUser(req);
    const filePath = (me && me.lastImagePath) ? me.lastImagePath : path.join(PUBLIC_DIR, 'default.png');
    fs.stat(filePath, (err, st) => {
        if (err || !st.isFile()) return sendText(res, 404, 'Pas d’image');
        const ext = path.extname(filePath).toLowerCase();
        const type = ext === '.png' ? 'image/png'
            : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg'
                : (ext === '.gif') ? 'image/gif' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        fs.createReadStream(filePath).pipe(res);
    });
}

function find(req, res) {
    const me = currentUser(req);
    if (!me) return sendJSON(res, 401, { error: 'Non connecté' });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const dir = url.searchParams.get('dir') || '.';

    const base = path.resolve(ROOT);
    const target = path.resolve(base, dir);
    if (!target.startsWith(base)) return sendJSON(res, 400, { error: 'Chemin invalide' });

    walk(target)
        .then(files => sendJSON(res, 200, { root: dir, count: files.length, files }))
        .catch(() => sendJSON(res, 500, { error: 'Impossible de lister' }));
}
function walk(dir) {
    return new Promise((resolve, reject) => {
        const out = [];
        fs.readdir(dir, { withFileTypes: true }, (err, list) => {
            if (err) return reject(err);
            let pending = list.length;
            if (!pending) return resolve(out);
            list.forEach(d => {
                const p = path.join(dir, d.name);
                if (d.isDirectory()) {
                    out.push({ type: 'dir', path: p });
                    walk(p).then(r => { out.push(...r); if (!--pending) resolve(out); }).catch(reject);
                } else {
                    out.push({ type: 'file', path: p });
                    if (!--pending) resolve(out);
                }
            });
        });
    });
}

module.exports = { start, register, login, logout, upload, show, find };
