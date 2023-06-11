// dhtchat.mjs
import { promisify } from 'util'
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { Command } from 'commander';
import DHT from 'bittorrent-dht';
import ed from 'bittorrent-dht-sodium';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class DHTChat {
  constructor() {
    this.key = null;
    this.seq = 1;
    this.subs = [];
    this.latest = null;
    this.dht = null;
  }

  // start dht
  async connect()  {
    this.dht = new DHT({ verify: ed.verify });
    await new Promise((resolve)=>this.dht.on('ready', resolve));
  }

  // close dht
  disconnect() {
    this.dht.destroy();
    this.dht = null;
  }

  // save datafile
  save() {
    const data = {
      pubkey: this.key.pk.toString('base64'),
      seckey: this.key.sk.toString('base64'),
      seq: this.seq,
      subs: this.subs,
      latest: this.latest,
    };

    const filePath = process.env['DHTCHAT_CFG'] ||path.join(os.homedir(), '.dhtchat');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // load datafile
  load() {
    const filePath = process.env['DHTCHAT_CFG'] ||path.join(os.homedir(), '.dhtchat');
    if (!fs.existsSync(filePath)) {
      return;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const parsedData = JSON.parse(data);

    this.key = {
      pk: Buffer.from(parsedData.pubkey, 'base64'),
      sk: Buffer.from(parsedData.seckey, 'base64'),
    };
    this.seq = parsedData.seq;
    this.subs = parsedData.subs;
    this.latest = parsedData.latest;
  }

  // generates a new keypair & saves it
  genkey() {
    this.key = ed.keygen();
    this.seq = 1;
    this.latest = null;
    this.save();
  }

  // putes a message
  async put(message) {
    const payload = {
      k: this.key.pk,
      seq: this.seq,
      v: Buffer.from(message, 'utf-8'),
      sign: (buf) => {
        return ed.sign(buf, this.key.sk);
      },
    };

    this.seq += 1;
    this.latest = payload;
    this.save();

    // will throw if we failed
    // fyi, this returns the sha1 hash of pk as a buffer
    await promisify(this.dht.put).bind(this.dht)(payload);
  }

  // reputes the most recent message
  async reput() {
    if (!this.latest || !this.key) return;
    await promisify(this.dht.put).bind(this.dht)(this.latest);
  }

  // gets most recent message from a user
  // pubkey is a base64 string
  async get(pubkey) {
    const hash = crypto.createHash('sha1');
    hash.update(Buffer.from(pubkey, 'base64'));
    const hashBuf = Buffer.from(hash.digest('hex'), 'hex')
    const res = await promisify(this.dht.get).bind(this.dht)(hashBuf, {cache:false});
    // re-put the content for whoever sent it
    await promisify(this.dht.put).bind(this.dht)(res)
    //const res = await new Promise((resolve, reject)=>this.dht.get( hashBuf, {cache:false}, (err, res)=>( err ? reject(err) : resolve(res) ) ))
    if (res && res.v)
      return { message: res.v.toString('utf-8'), seq: res.seq };
  }

  // adds a user to the subscriptions
  subscribe(pubkey, handle) {
    const user = {
      pubkey,
      handle,
    };
    this.subs.push(user);
    this.save();
  }
}

const program = new Command();

program
  .command('genkey')
  .description('Generate a new key and sequence number')
  .action(() => {
    const dhtchat = new DHTChat();
    dhtchat.genkey();
    console.log(`secret key: ${dhtchat.key.sk.toString('base64')}`)
    console.log(`public key: ${dhtchat.key.pk.toString('base64')}`)
    dhtchat.save();
  });

program
  .command('whoami')
  .description('Prints my public key to console')
  .action(()=>{
    const dhtchat = new DHTChat();
    dhtchat.load();
    console.log(dhtchat.key.pk.toString('base64'));
  });

program
  .command('reput')
  .description('Re-putes the latest message so it does not expire')
  .option('-w, --wait', 'Repeatedly reput every 2 minutes forever')
  .action(async (options)=>{
    const dhtchat = new DHTChat();
    dhtchat.load();
    if (!dhtchat.latest) return;
    await dhtchat.connect();
    await dhtchat.reput();
    while (options.wait) {
      await sleep(30*60*1000)
      await dhtchat.reput();
    }
    if (!options.wait)
      await sleep(5000)  // not sure why but we actually need this for reput to work?
    dhtchat.disconnect();
  });

program
  .command('put')
  .description('put a message to the DHT')
  .option('-w, --wait', 'Repeatedly reput the message forever')
  .arguments('<message>')
  .action(async (message, options) => {
    const dhtchat = new DHTChat();
    dhtchat.load();
    await dhtchat.connect();
    dhtchat.put(message);
    while (options.wait) {
      await dhtchat.reput();
      await sleep(30*60*1000)
    }
    if (!options.wait)
      await sleep(5000)  // not sure why but we actually need this for put to work?
    dhtchat.disconnect();
  });

program
  .command('get <pubkey>')
  .description('Get the latest/current message from a public key')
  .action(async (pubkey) => {
    const dhtchat = new DHTChat();
    // just a flex... don't need to load to get :P
    //dhtchat.load();
    await dhtchat.connect();
    const msg = await dhtchat.get(pubkey);
    await sleep(5000)  // make our re-put actually work
    console.log(msg);
    dhtchat.disconnect();
  });

program
  .command('subscribe <pubkey> <handle>')
  .description('Subscribe to messages issued by specific user')
  .action((pubkey, handle) => {
    const dhtchat = new DHTChat();
    dhtchat.load();
    dhtchat.subscribe(pubkey, handle);
    dhtchat.save();
  });

program
  .command('watch')
  .description('Watches for new messages from any of your subs and prints them to screen')
  .action(async () => {
    const poll = 20;  // poll every 20 seconds
    const dhtchat = new DHTChat();
    dhtchat.load();
    await dhtchat.connect();
    const latestMsgs = {};
    while (true) {
      for (const sub in this.subs) {
        const msg = await dhtchat.get(sub.pubkey);
        // if msg differs, print it
        console.log({sub, msg});
      }
      await sleep(poll * 1000);
    }
  });

async function main() {
  await program.parseAsync(process.argv);
}
main().then(()=>true).catch((err)=>{
  console.error("FATAL ERROR", err);
  process.exit();
})

