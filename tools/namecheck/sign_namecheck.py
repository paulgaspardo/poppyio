#!/usr/bin/env python
# usage: sign_namecheck.py key_file.json example.com "Example Site Name"

import getpass
import json
import sys
import time

import nacl.signing
import nacl.pwhash
import nacl.secret
import nacl.utils
import nacl.encoding

with open(sys.argv[1]) as file:
	key = json.load(file)

password = getpass.getpass()

salt = nacl.encoding.Base64Encoder.decode(key['salt'])
ops = key['ops']
mem = key['mem']
secret_key = nacl.pwhash.argon2i.kdf(
	nacl.secret.SecretBox.KEY_SIZE,
	bytes(password, 'ascii'),
	salt,
	opslimit = ops,
	memlimit = mem
)

secret_box = nacl.secret.SecretBox(secret_key)
encrypted_signing_key = nacl.encoding.Base64Encoder.decode(key['private'])
signing_key = nacl.signing.SigningKey(secret_box.decrypt(encrypted_signing_key))

message = bytes(json.dumps({
	'd': sys.argv[2],
	'n': sys.argv[3],
	't': int(time.time())
}, ensure_ascii=False,separators=(',',':')), 'utf-8')

signed = str(signing_key.sign(message, encoder=nacl.encoding.Base64Encoder), 'ascii')

print(signed)
