function route(handle, pathname, req, res) {
    console.log(`About to route ${pathname}`);
    if (typeof handle[pathname] === 'function') {
        handle[pathname](req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404: Resource not found');
    }
}
module.exports = { route };
