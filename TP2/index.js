const server = require('./server');
const router = require('./router');
const h = require('./requestHandlers');

const handle = {
    '/':        h.start,
    '/start':   h.start,
    '/register':h.register,
    '/login':   h.login,
    '/logout':  h.logout,
    '/upload':  h.upload,
    '/show':    h.show,
    '/find':    h.find,
};
server.start(router.route, handle);
