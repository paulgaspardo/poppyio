#!/usr/bin/env python

import getpass
import json

import nacl.signing
import nacl.pwhash
import nacl.secret
import nacl.utils
import nacl.encoding

signing_key = nacl.signing.SigningKey.generate()

password = getpass.getpass()

salt = nacl.utils.random(nacl.pwhash.argon2i.SALTBYTES)
ops = nacl.pwhash.argon2i.OPSLIMIT_SENSITIVE
mem = nacl.pwhash.argon2i.MEMLIMIT_SENSITIVE
secret_key = nacl.pwhash.argon2i.kdf(
	nacl.secret.SecretBox.KEY_SIZE,
	bytes(password, 'ascii'),
	salt,
	opslimit = ops,
	memlimit = mem
)

secret_box = nacl.secret.SecretBox(secret_key)
nonce = nacl.utils.random(nacl.secret.SecretBox.NONCE_SIZE)

encrypted_signing_key = secret_box.encrypt(bytes(signing_key), nonce, encoder=nacl.encoding.Base64Encoder)

full_key = {
	'salt': str(nacl.encoding.Base64Encoder.encode(salt), 'ascii'),
	'ops': ops,
	'mem': mem,
	'nonce': str(nacl.encoding.Base64Encoder.encode(nonce), 'ascii'),
	'private': str(encrypted_signing_key, 'ascii'),
	'public': str(signing_key.verify_key.encode(nacl.encoding.Base64Encoder), 'ascii')
}

print(json.dumps(full_key))
