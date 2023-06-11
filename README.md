Dumb DHT chat program

Stores some data in .dhtchat or path pointed to by DHTCHAT_CFG env var


Core functionality, more or less done:

dhtchat genkey -> generates and stores a new keypair
dhtchat whoami -> prints your public key (share this to friends)
dhtchat get pubkey -> gets the latest message from DHT for this pubkey
dhtchat put "Your Message Here" -> stores a message in the DHT with your key


Some less reasonable / in-progress stuff:

dhtchat reput -> refreshes latest sent message
dhtchat subscribe <pubkey> <handle> -> updates your list of subs (useless right now)
dhtchat watch -> notify on a new message for any of your subs (in progress)
