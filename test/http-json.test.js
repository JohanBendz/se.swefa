'use strict';

const { EventEmitter } = require('node:events');
const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');

const { requestJson } = require('../lib/http-json');

test('dependency-free HTTPS client parses a JSON response', async () => {
  const originalGet = https.get;

  https.get = (url, options, callback) => {
    assert.equal(url, 'https://example.test/data.json');
    assert.equal(options.headers.Accept, 'application/json');

    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = error => request.emit('error', error);

    const response = new EventEmitter();
    response.statusCode = 200;
    response.statusMessage = 'OK';
    response.headers = { 'content-type': 'application/json; charset=utf-8' };
    response.setEncoding = () => {};
    response.resume = () => {};

    process.nextTick(() => {
      callback(response);
      response.emit('data', '{"ok":true}');
      response.emit('end');
    });

    return request;
  };

  try {
    assert.deepEqual(await requestJson('https://example.test/data.json'), { ok: true });
  } finally {
    https.get = originalGet;
  }
});

test('dependency-free HTTPS client rejects non-JSON responses', async () => {
  const originalGet = https.get;

  https.get = (url, options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = error => request.emit('error', error);

    const response = new EventEmitter();
    response.statusCode = 200;
    response.statusMessage = 'OK';
    response.headers = { 'content-type': 'text/plain' };
    response.setEncoding = () => {};
    response.resume = () => {};

    process.nextTick(() => {
      callback(response);
      response.emit('data', 'not json');
      response.emit('end');
    });

    return request;
  };

  try {
    await assert.rejects(
      requestJson('https://example.test/data.txt'),
      /SMHI returned non-JSON/,
    );
  } finally {
    https.get = originalGet;
  }
});
