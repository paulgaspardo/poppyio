let { resolveName, namecheckKeys } = require('../../target/launch/resolve');
let assert = require('assert');
let xhrMock = require('xhr-mock').default;

global.atob = require('atob');
global.btoa = require('btoa');

xhrMock.setup();

describe('resolveName', () => {

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

	context('Resolves to the .well-known URL', async () => {
		const HOST_META_URL = 'https://example.com/.well-known/host-meta.json';
		beforeEach(() => {
			xhrMock.reset();
		})
		let setHostMeta = (data, domain) => {
			xhrMock.get(domain ? 'https://' + domain + '/.well-known/host-meta.json' : HOST_META_URL, {
				status: 200,
				body: JSON.stringify(data)
			});
		};

		let HOST_META_BASE = {
			links: [
				{
					rel: 'https://poppy.io/a/poppy',
					href: 'http://www.example.com/poppy'
				}
			]
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
			assert.equal('http://www.example.com/poppy', resolved.url);
			assert(!resolved.namechecked);
			assert(!resolved.name);
		});

		it('Throws if there is a 404', async () => {
			xhrMock.get(HOST_META_URL, { status: 404 });
			try {
				await resolveName('example.com');
			} catch (e) {
				assert(e.message.indexOf('404') != -1);
				return;
			}
			assert.fail();
		});
		it('Throws if there is a 500', async () => {
			xhrMock.get(HOST_META_URL, { status: 500 });
			try {
				await resolveName('example.com');
			} catch (e) {
				assert(e.message.indexOf('500') != -1);
				return;
			}
			assert.fail();
		})
	});

});
