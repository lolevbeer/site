const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '.cert', 'lolev.dev+3-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '.cert', 'lolev.dev+3.pem')),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
       
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
       
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
       
      console.log(`> Ready on https://${hostname}:${port}`);
       
      console.log(`> Access your site at https://lolev.dev:${port}`);
    });
});
