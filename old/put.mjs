import ed from 'bittorrent-dht-sodium'
import DHT from 'bittorrent-dht'
const dht = new DHT()

// generate a key like this
//const keypair = ed.keygen()
//console.log("key", {k: JSON.stringify(keypair)})

// create it manually like this
const keypair = {
  pk: Buffer.from([248,192,49,252,185,116,234,130,255,217,63,132,151,254,53,172,240,135,215,252,74,81,234,216,209,75,128,164,89,2,159,75]),
  sk: Buffer.from([254,41,221,61,60,35,244,180,247,24,179,135,221,123,226,52,8,44,36,211,55,75,163,47,61,74,191,251,96,228,108,226,248,192,49,252,185,116,234,130,255,217,63,132,151,254,53,172,240,135,215,252,74,81,234,216,209,75,128,164,89,2,159,75]),
};

const value = Buffer.alloc(200).fill('somethingelse') // the payload you want to send
const opts = {
  k: keypair.pk,
  seq: 1,
  v: value,
  sign: function (buf) {
    return ed.sign(buf, keypair.sk)
  }
}

dht.put(opts, function (err, hash) {
  console.error('error=', err)
  console.log('hash=', JSON.stringify(hash));
})
