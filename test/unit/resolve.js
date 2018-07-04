let { resolveName, namecheckKeys } = require('../../target/launch/resolve');
let assert = require('assert');
let xhrMock = require('xhr-mock').default;

global.atob = require('atob');
global.btoa = require('btoa');

xhrMock.setup();

describe('resolveName', () => {

	beforeEach(() => {
		xhrMock.reset();
	});

	context('Rejects if the name is invalid', () => {
		it('being missing', async () => {
			try {
				await resolveName();
			} catch (e) {
				return;
			}
			assert.fail();
		});
		it('being blank', async () => {
			try {
				await resolveName('');
			} catch (e) {
				return;
			}
			assert.fail();
		});
	});

	let HOST_META_BASE = {
		links: [
			{
				rel: 'https://poppy.io/a/poppy',
				href: 'http://www.example.com/poppy'
			}
		]
	};

	context('Resolves to the .well-known URL', () => {
		const HOST_META_URL = 'https://example.com/.well-known/host-meta.json';

		let setHostMeta = (data, domain) => {
			xhrMock.get(domain ? 'https://' + domain + '/.well-known/host-meta.json' : HOST_META_URL, {
				status: 200,
				body: JSON.stringify(data)
			});
		};

		it('Picks up service URL', async () => {
			setHostMeta(HOST_META_BASE);

			let resolved = await resolveName('example.com');
			assert.equal('http://www.example.com/poppy', resolved.url);
			assert(!resolved.name);
			assert(!resolved.namechecked);
		});

		let HOST_META_WITH_NAMECHECK = Object.assign({
			properties: {
				// {"d":"example.com","n":"Example.com","t":1530301746}
				"https://poppy.io/#namecheck.1806": "bUY9HagR8SxKv3gjjRjhv/q75APW8opYrrBffvS6+WwQNQ9U+t5xdTnYtf3RKkG7xoGWhnndRJ6nnYObtBn7DnsiZCI6ImV4YW1wbGUuY29tIiwibiI6IkV4YW1wbGUuY29tIiwidCI6MTUzMDMwMTc0Nn0="
			}
		}, HOST_META_BASE);

		it('Picks up valid namecheck and service URL', async () => {
			setHostMeta(HOST_META_WITH_NAMECHECK, 'example.com');

			let resolved = await resolveName('example.com');
			assert.equal(resolved.namechecked, 'https://poppy.io/#namecheck.1806');
			assert.equal(resolved.name, 'Example.com');
		});

		it('Ignores namecheck for invalid domain', async () => {
			setHostMeta(HOST_META_WITH_NAMECHECK, 'example2.com');

			let resolved = await resolveName('example2.com');
			assert.equal(resolved.url, 'http://www.example.com/poppy');
			assert(!resolved.namechecked);
			assert(!resolved.name);
		});

		it('Throws if there is a 404', async () => {
			xhrMock.get(HOST_META_URL, { status: 404 });
			try {
				await resolveName('example.com');
			} catch (e) {
				assert(e.message.indexOf('404') !== -1);
				return;
			}
			assert.fail();
		});
		it('Throws if there is a 500', async () => {
			xhrMock.get(HOST_META_URL, { status: 500 });
			try {
				await resolveName('example.com');
			} catch (e) {
				assert(e.message.indexOf('500') !== -1);
				return;
			}
			assert.fail();
		});
		it('Throws if the response is not JSON', async () => {
			xhrMock.get(HOST_META_URL, {
				status: 200,
				body: 'NOT JSON'
			});
			try {
				await resolveName('example.com');
			} catch (e) {
				assert(e.message.indexOf('JSON') !== -1);
				return;
			}
			assert.fail();
		});
	});

	it('Uses XMLHttpRequest factory', async () => {
		xhrMock.get('/host-meta-proxy/example3.com', {
			status: 200,
			body: JSON.stringify(HOST_META_BASE)
		});
		let called = false;
		let result = await resolveName('example3.com', domain => {
			called = true;
			let req = new XMLHttpRequest;
			req.open('GET', '/host-meta-proxy/example3.com');
			return req;
		});
		assert.equal(called, true);
		assert.equal(result.url, 'http://www.example.com/poppy');
	});

});
