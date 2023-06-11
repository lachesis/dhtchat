import ed from 'bittorrent-dht-sodium'
import DHT from 'bittorrent-dht'
const dht = new DHT({ verify: ed.verify }) // you MUST specify the "verify" param if you want to get mutable content, otherwise null will be returned

// sha1 hash of the ed25519 key used to set
const key = Buffer.from('f0081ec88b73546122c082b34ef82ec6dd9be5c7', 'hex');
//const key = Buffer.from([156,85,92,255,226,174,204,153,160,102,40,96,193,76,6,96,167,52,50,203]);

dht.get(key, function (err, res) {
  //console.log("Got RES and err", {res, err})
  console.log("DATA", {data: res.v.toString('utf8')})
})
