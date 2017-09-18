const http = require('http');
const https = require('https');
const url = require('url');
const parseXml = require('xml2json').toJson;
const zlib = require('zlib');
const util = require('util');
const HttpsProxyAgent = require('https-proxy-agent');

module.exports = (urlFull, headers = {}, body, method = "GET", proxy) => {
  //console.log(urlFull);
  let urlParsed = url.parse(urlFull);
  let httpLib = urlParsed.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    let parts = Buffer.from('');
    let agent = proxy ? new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`) : null;
    let request = {
      method: method,
      rejectUnauthorized: false,
      host: urlParsed.hostname,
      port: urlParsed.protocol === 'https:' ? 443 : 80,
      path: urlParsed.path,
      headers: headers,
      agent: agent
    };
    let req = httpLib.request(request, (res) => {
      res.on('data', (data) => {
        parts = Buffer.concat([parts, data]);
      });
      res.on('end', async() => {
        try {
          if (res.headers['content-encoding'] === 'gzip') {
            parts = await util.promisify(zlib.gunzip)(parts);
          }
          let r;
          if (res.headers['content-type'] && (res.headers['content-type'].indexOf('application/xml') !== -1 || res.headers['content-type'].indexOf('text/xml') !== -1)) {
            r = parseXml(parts, { object: true });
          } else if (res.headers['content-type'] && res.headers['content-type'].indexOf('text/html') !== -1) {
            r = parts.toString();
          } else if (res.headers['content-type'] && res.headers['content-type'].indexOf('application/json') !== -1) {
            r = JSON.parse(parts.toString());
          } else {
            r = parts;
          }
          if ([200].includes(res.statusCode)) {
            resolve(r);
          } else {
            let result = { statusCode: res.statusCode, headers: res.headers, r };
            reject(result);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    if (body) {
      req.write(body);
    }
    req.end();
    req.on('error', (err) => {
      reject(err);
    });
  });
};
