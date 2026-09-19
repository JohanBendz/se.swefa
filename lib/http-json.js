'use strict';

const https = require('https');
const { URL } = require('url');

function requestJson(url, {
  timeoutMs = 10000,
  maxRedirects = 3,
  maxBytes = 2 * 1024 * 1024,
} = {}) {
  return new Promise((resolve, reject) => {
    const visit = (currentUrl, redirectsRemaining) => {
      const request = https.get(currentUrl, {
        headers: { Accept: 'application/json' },
      }, (response) => {
        const statusCode = response.statusCode ?? 0;

        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          response.resume();

          if (redirectsRemaining <= 0) {
            reject(new Error('SMHI request exceeded redirect limit'));
            return;
          }

          const nextUrl = new URL(response.headers.location, currentUrl).toString();
          visit(nextUrl, redirectsRemaining - 1);
          return;
        }

        response.setEncoding('utf8');
        let body = '';
        let bodyBytes = 0;

        response.on('data', (chunk) => {
          bodyBytes += Buffer.byteLength(chunk);
          if (bodyBytes > maxBytes) {
            response.destroy(new Error(`SMHI response exceeded ${maxBytes} bytes`));
            return;
          }
          body += chunk;
        });

        response.on('error', reject);

        response.on('end', () => {
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(
              `SMHI request failed: ${statusCode} ${response.statusMessage ?? ''} ${body.slice(0, 300)}`,
            ));
            return;
          }

          const contentType = response.headers['content-type'] ?? '';
          if (!contentType.includes('json')) {
            reject(new Error(`SMHI returned non-JSON: ${contentType} ${body.slice(0, 300)}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`SMHI returned invalid JSON: ${error.message}`));
          }
        });
      });

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`SMHI request timed out after ${timeoutMs} ms`));
      });
      request.on('error', reject);
    };

    visit(url, maxRedirects);
  });
}

module.exports = {
  requestJson,
};
