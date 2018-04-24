import { crypto_sign_open } from "./nacl/crypto_sign_open";

export interface ResolveResult {
	url: string;
	origins?: string[];
	name?: string;
	namechecked?: string;
}

export function resolveName(domain: string, namecheck?: boolean): Promise<ResolveResult> {
	return new Promise((resolve, reject) => {
		domain = (domain||'').trim().toLowerCase();
		if (!domain) {
			return reject(Error('Poppy.io: no-domain'));
		}
		if (typeof domain.normalize === 'function') {
			domain = domain.normalize('NFKC');
		}
		let req = new XMLHttpRequest;
		req.open('GET', 'https://' + domain + '/.well-known/host-meta.json');
		req.onload = () => {
			if (req.status !== 200) return reject(Error('Poppy.io: lookup-error, ' + req.status));
			try {
				let hostMeta: any = JSON.parse(req.responseText);
				let links: any = hostMeta.links;
				if (!Array.isArray(links)) {
					return reject(Error('Poppy.io: no-dialog-found'));
				}
				let result: ResolveResult|undefined = undefined;
				for (let i = 0; i < links.length; i++) {
					let link = links[i];
					if (!link) continue;
					if (link.rel !== 'https://poppy.io/a/poppy') continue;
					if (typeof link.href !== 'string') continue;
					let url = link.href.match(/^[a-zA-Z0-9\-]+\:/) ? link.href : 'https://' + domain + '/' + link.href;
					result = { url };
					if (link.properties) {
						for (let propertyName in link.properties) {
							if (propertyName === 'https://poppy.io/a/origins') {
								let origins: any = link.properties[propertyName];
								if (typeof origins === 'string') {
									result.origins = origins.split(' ');
								}
							}
						}
					}
					break;
				}
				if (result) {
					if (hostMeta.properties && (namecheck !== true)) {
						for (let keyName in namecheckKeys) {
							if (typeof hostMeta.properties[keyName] !== 'string') continue;
							if (verifyNamecheck(domain, keyName, hostMeta.properties[keyName], result)) break;
						}
					}
					return resolve(result);
				}
				return reject(Error('Poppy.io: no-dialog-found'));
			} catch (e) {
				return reject(e);
			}
		};
		req.onerror = () => {
			console.log('onerror');
			reject(Error('Poppy.io: lookup-error'));
		}
		req.send();
	});
}

declare function escape(s:string): string;

function bytesFromBase64(string: string) {
	var byteString = atob(decodeURIComponent(escape(string)));
	var bytes = new Uint8Array(byteString.length);
	for (var i = 0; i < byteString.length; i++) {
		bytes[i] = byteString.charCodeAt(i);
	}
	return bytes;
}

export var namecheckKeys: {[id:string]:string} = {
	"https://poppy.io/a/namecheck": "mLSFDoakajER2ueB82T/+zDYFNJF1xonCkNspbUL4WU="
};

export function verifyNamecheck(resolving: string, keyName: string, signed: string, result: ResolveResult): boolean {
	let keyBytes = bytesFromBase64(namecheckKeys[keyName]);
	let signedBytes = bytesFromBase64(signed);
	let tmp = new Uint8Array(signed.length);
	let mlen = crypto_sign_open(tmp, signedBytes, signed.length, keyBytes);
	if (mlen < 0) return false;
	let mByteString = '';
	for (let b = 0; b < mlen; b++) mByteString += String.fromCharCode(tmp[b]);
	let namecheck: any;
	try {
		namecheck = JSON.parse(decodeURIComponent(escape(mByteString)));
	} catch (e) {
		return false;
	}
	if (typeof namecheck.d !== 'string') return false;
	let resolvingSegments = resolving.split('.');
	let verifiedSegments: string[] = namecheck.d.split('.');
	if (resolvingSegments.length !== verifiedSegments.length) return false;
	for (let i = 0; i < verifiedSegments.length; i++) {
		let forms = verifiedSegments[i].split('|');
		if (!forms.some(verifiedForm => verifiedForm === resolvingSegments[i])) return false;
	}
	result.namechecked = keyName;
	if (typeof namecheck.n === 'string') result.name = namecheck.n;
	return true;
}
