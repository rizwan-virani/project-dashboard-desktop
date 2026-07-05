const path = require('path');
const server = require(path.join(__dirname, '..', 'src', 'server.js'));
const appRoot = path.join(__dirname, '..', 'build', 'app');
const dataFile = path.join(__dirname, '..', 'build', 'dev-data.json');
server.start({ appRoot, dataFile, port: 8770 })
  .then(({ port }) => console.log('dev data server on http://127.0.0.1:' + port))
  .catch((e) => { console.error(e); process.exit(1); });
