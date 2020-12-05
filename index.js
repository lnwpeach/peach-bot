'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const config = require('./config.json');
const mysql = require('mysql');

var con = mysql.createConnection({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database
});

con.connect(function (err) {
  if (err) throw err;
});

// create LINE SDK client
const client = new line.Client(config);

const app = express();

const peach = 'U476e9b43e847f9cb0610c6be07b7bda7';
const aoi = 'U91ed37b6b3c80629914ece2680ec4db5';

// webhook callback
app.post('/webhook', line.middleware(config), (req, res) => {
  // req.body.events should be an array of events
  if (!Array.isArray(req.body.events)) {
    return res.status(500).end();
  }
  // handle events separately
  Promise.all(req.body.events.map(event => {
    console.log('event', event);

    var dt = new Date(Date.now() + 25200000).toISOString().replace(/T/, ' ').replace(/\..+/, ''); // UTC +7
    var sql = "insert into log (create_dt, detail) values ?";
    var values = [[dt, JSON.stringify(event)]];
    con.query(sql, [values], function (err, result) {
      if (err) throw err;
    });

    // check verify webhook event
    if (event.replyToken === '00000000000000000000000000000000' ||
      event.replyToken === 'ffffffffffffffffffffffffffffffff') {
      return;
    }
    return handleEvent(event);
  }))
    .then(() => res.end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// simple reply function
const replyText = (token, texts) => {
  texts = Array.isArray(texts) ? texts : [texts];
  return client.replyMessage(
    token,
    texts.map((text) => ({ type: 'text', text }))
  );
};

const pushText = (to, texts) => {
  texts = Array.isArray(texts) ? texts : [texts];
  return client.pushMessage(
    to,
    texts.map((text) => ({ type: 'text', text }))
  );
};

// callback function to handle a single event
function handleEvent(event) {
  switch (event.type) {
    case 'message':
      const message = event.message;
      switch (message.type) {
        case 'text':
          return handleText(message, event.replyToken, event);
        case 'image':
          return handleImage(message, event.replyToken);
        case 'video':
          return handleVideo(message, event.replyToken);
        case 'audio':
          return handleAudio(message, event.replyToken);
        case 'location':
          return handleLocation(message, event.replyToken);
        case 'sticker':
          return handleSticker(message, event.replyToken);
        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }

    case 'follow':
      return replyText(event.replyToken, 'Got followed event');

    case 'unfollow':
      return console.log(`Unfollowed this bot: ${JSON.stringify(event)}`);

    case 'join':
      return replyText(event.replyToken, `Joined ${event.source.type}`);

    case 'leave':
      return console.log(`Left: ${JSON.stringify(event)}`);

    case 'postback':
      let data = event.postback.data;
      return replyText(event.replyToken, `Got postback: ${data}`);

    case 'beacon':
      // Send Aoi
      if (event.source.userId == peach) {
        handleBeacon(event.replyToken, event);
        return false;
      }
      const dm = `${Buffer.from(event.beacon.dm || '', 'hex').toString('utf8')}`;
      return replyText(event.replyToken, `${event.beacon.type} beacon hwid : ${event.beacon.hwid} with device message = ${dm}`);

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }
}

function handleText(message, replyToken, event) {
  var text = message.text;
  var userId = event.source.userId;
  if(text === '!id') text = event.source.userId;
  else if(userId === peach) {
    var pos = text.indexOf(' ');
    if(pos !== -1) {
      var cmd = text.slice(0, pos);
      if(cmd === '!aoi') pushText(aoi, text.slice(pos+1));
      else if(cmd === '!peach') pushText(peach, text.slice(pos+1));
      else return replyText(replyToken, text);

      return pushText(peach, 'Sent');
    }
  }

  return replyText(replyToken, text);
}

function handleBeacon(replyToken, event) {
  pushText(peach, 'Sent to aoi..');
  return pushText(aoi, 'ถึงบ้านแล้วค้าบ');
}

function handleImage(message, replyToken) {
  return replyText(replyToken, 'Got Image');
}

function handleVideo(message, replyToken) {
  return replyText(replyToken, 'Got Video');
}

function handleAudio(message, replyToken) {
  return replyText(replyToken, 'Got Audio');
}

function handleLocation(message, replyToken) {
  return replyText(replyToken, 'Got Location');
}

function handleSticker(message, replyToken) {
  return replyText(replyToken, 'Got Sticker');
}

const port = config.port;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
