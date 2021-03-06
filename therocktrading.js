/* TheRockTrading.com npm 0.9.0 */

var querystring = require("querystring");
var https = require('https');
var _ = require('underscore');
var crypto = require('crypto');

_.mixin({
  // compact for objects
  compactObject: function(to_clean) {
    _.map(to_clean, function(value, key, to_clean) {
      if (value === undefined)
        delete to_clean[key];
    });
    return to_clean;
  }
});

// error object this lib returns
var TherocktradingError = function TherocktradingError(message, meta) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.meta = meta;
};

var Therocktrading = function(key, secret, userAgent, timeout, host) {
  this.key = key;
  this.secret = secret;
  this.agent = userAgent || "TheRockTrading node.js agent" ;
  this.timeout = timeout || 5000;
  this.host = host || 'api.therocktrading.com';

  _.bindAll(this);
}

Therocktrading.prototype._request_auth = function(method, path, data, callback) {
  // console.log("Request path: ", path);
  var timeout = this.timeout;
  path = "/v1/" + path;
  var options = {
    host: this.host,
    path: path,
    method: method,
    headers: {
      'User-Agent': this.agent
    }
  };

  //var payload = querystring.stringify(data);
  var payload = '';
  // console.log("data is: ", data);
  if (data === '') {
    console.log("Data is empty");
  } else {
    if (method === 'post') {
      payload = JSON.stringify(data);
      // console.log("payload: ", payload);
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    //if (method === 'get') {
    //  path += querystring.stringify(data);
    //}
  }

  var nonce = this._generateNonce();
  var message = nonce + 'https://' + this.host + path;
  // console.log("message: ", message);
  var signer = crypto.createHmac('sha512', this.secret);
  var signature = signer.update(message).digest('hex');

  options.headers['Content-Type'] = 'application/json';
  options.headers['X-TRT-KEY'] = this.key;
  options.headers['X-TRT-NONCE'] = nonce;
  options.headers['X-TRT-SIGN'] = signature;
  
  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    var body_answer = '';
    res.on('data', function(d) {
      //console.log('BODY: ', data);
      body_answer += d;
    });
    res.on('end', function() {
      if (res.statusCode !== 200 && res.statusCode !== 201) {
        var message;
        try {
          message = JSON.parse(body_answer);
        } catch(e) {
          message = body_answer;
        }
        return callback(new TherocktradingError('Therocktrading error ' + res.statusCode, message));
      }
      try {
        var json = JSON.parse(body_answer);
      } catch (err) {
        return callback(err);
      }
      callback(null, json);
    });
  });

  req.on('error', function(err) {
    callback(err);
  });

 // req.write(JSON.stringify(payload));
  req.end(payload);
}

// if you call new Date too fast it will generate
// the same ms, helper to make sure the nonce is
// truly unique (supports up to 999 calls per ms).
Therocktrading.prototype._generateNonce = function() {
  var now = new Date().getTime();

  if(now !== this.last)
    this.nonceIncr = -1;

  this.last = now;
  this.nonceIncr++;

  // add padding to nonce incr
  // @link https://stackoverflow.com/questions/6823592/numbers-in-the-form-of-001
  var padding =
    this.nonceIncr < 10 ? '000' :
      this.nonceIncr < 100 ? '00' :
        this.nonceIncr < 1000 ?  '0' : '';
  return now + padding + this.nonceIncr;
}

Therocktrading.prototype._request = function(method, path, data, callback, args) {
  //console.log("Request method: ", method);
  //console.log("Request path: ", path);
  //console.log("Request data: ", data);
  //console.log("Request callback: ", callback);
  //console.log("Request args: ", args);  
  var timeout = this.timeout;
  var options = {
    host: this.host,
    path: path,
    method: method,
    headers: {
      'User-Agent': 'Mozilla/4.0 (compatible; TheRockTrading node.js client)'
    }
  };

  options.headers['Content-Type'] = 'application/json';
  if(method === 'post') {
    options.headers['Content-Length'] = Buffer.byteLength(data);
  }

  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    var buffer = '';
    res.on('data', function(data) {
      buffer += data;
    });
    res.on('end', function() {
      if (res.statusCode !== 200) {
        var message;

        try {
          message = JSON.parse(buffer);
        } catch(e) {
          message = buffer;
        }

        return callback(new TherocktradingError('Therocktrading error ' + res.statusCode, message));
      }
      try {
        var json = JSON.parse(buffer);
      } catch (err) {
        return callback(err);
      }
      callback(null, json);
    });
  });

  req.on('error', function(err) {
    callback(err);
  });

  req.on('socket', function (socket) {
    socket.setTimeout(timeout);
    socket.on('timeout', function() {
      req.abort();
    });
  });

  req.end(data);
}

Therocktrading.prototype._get = function(market, action, callback, args) {
  args = _.compactObject(args);
  
  if(market)
    var path = '/v1/funds/' + market.toString().toUpperCase() + '/' + action;
  else
    var path = '/v1/' + action;

  path += (querystring.stringify(args) === '' ? '' : '/?') + querystring.stringify(args);
  this._request('get', path, undefined, callback, args)
}

Therocktrading.prototype._getv2 = function(market, action, callback, args) {
  args = _.compactObject(args);

  if(market)
    var path = '/v2/funds/' + market.toString().toUpperCase() + '/' + action;
  else
    var path = '/v2/' + action;

  path += (querystring.stringify(args) === '' ? '' : '/?') + querystring.stringify(args);
  this._request('get', path, undefined, callback, args)
}


// Public API
Therocktrading.prototype.trades = function(market, options, callback) {
  if(!callback) {
    callback = options;
    options = undefined;
  }
  this._get(market, 'trades', callback, options);
}

Therocktrading.prototype.ticker = function(market, callback) {
  this._get(market, 'ticker', callback);
}

Therocktrading.prototype.order_book = function(market, limit_entries, callback) {
  if(!callback) {
    callback = limit_entries;
    limit_entries = undefined;
  }
  var options;
  if(typeof limit === 'object')
    options = limit_entries;
  else
    options = {limit: limit_entries};
  this._get(market, 'orderbook', callback, options);
}

Therocktrading.prototype.trading_pairs_info = function(callback) {
  this._getv2(null, 'trading-pairs-info', callback);
}

// Private API
// (you need to have key / secret)
Therocktrading.prototype.balance = function(currency, callback) {
  this._request_auth('get', 'balances/' + currency, '', callback);
}

Therocktrading.prototype.balances = function(callback) {
  this._request_auth('get', 'balances', '', callback);
}

Therocktrading.prototype.user_transactions = function(market, options, callback) {
  if(!callback) {
    callback = options;
    options = undefined;
  }
  this._post(market, 'transactions', callback, options);
}

Therocktrading.prototype.open_orders = function(market, callback) {
  this._request_auth('get', 'funds/' + market + '/orders', '', callback);
}

Therocktrading.prototype.order_status = function (market, id, callback) {
  this._request_auth('get', 'funds/' + market + '/orders/' + id, '', callback);
};

Therocktrading.prototype.cancel_order = function(market, id, callback) {
  this._request_auth('delete', 'funds/' + market + '/orders/' + id, '', callback);
}

Therocktrading.prototype.cancel_all_orders = function(callback) {
  this._delete(null, 'remove_all', callback, null, true);
}

Therocktrading.prototype.buy = function(market, amount, price, callback) {
  var data = {
    side: 'buy',
    amount: String(amount),
    price: String(price)
  };
  this._request_auth('post', 'funds/' + market + '/orders', data, callback);
}

Therocktrading.prototype.buyMarket = function(market, amount, callback) {
  var data = {
    side: 'buy',
    amount: String(amount),
    price: 0
  };
  this._request_auth('post', 'funds/' + market + '/orders', data, callback);
}

Therocktrading.prototype.sell = function(market, amount, price, callback) {
  var data = {
    side: 'sell',
    amount: String(amount),
    price: String(price)
  };
  this._request_auth('post', 'funds/' + market + '/orders', data, callback);
}

Therocktrading.prototype.sellMarket = function(market, amount, callback) {
  var data = {
    side: 'sell',
    amount: String(amount),
    price: 0
  };
  this._request_auth('post', 'funds/' + market + '/orders', data, callback);
}

Therocktrading.prototype.withdrawal_requests = function(callback) {
  this._post(null, 'withdrawal_requests', callback, null, true);
}

// bitcoin

Therocktrading.prototype.bitcoin_withdrawal = function(amount, address, instant, callback) {
  this._post(null, 'bitcoin_withdrawal', callback, {
    amount: amount,
    address: address,
    instant: instant
  }, true);
}

Therocktrading.prototype.bitcoin_deposit_address = function(callback) {
  this._post(null, 'bitcoin_deposit_address', callback, null, true);
}

Therocktrading.prototype.unconfirmed_btc = function(callback) {
  this._post(null, 'unconfirmed_btc', callback, null, true);
}

module.exports = Therocktrading;
