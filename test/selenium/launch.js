const listen = require('../lib/server');
const { Builder, By } = require('selenium-webdriver');
const assert = require('assert');

describe('Launch page', () => {
	let server;
	let driver;

	before(() => {
		server = listen();
	});
	after(() => {
		server.close();
	});
	beforeEach(() => {
		driver = new Builder().forBrowser('chrome').build();
	});
	afterEach(() => {
		driver.close();
	});

	it('Opens', async () => {
		let windows = await driver.getAllWindowHandles();
		assert.equal(windows.length, 1);
		await driver.navigate().to('http://localhost:' + server.address().port + '/test/pages/readme_example.html');
		await driver.findElement(By.id('pickButton')).click();
		windows = await driver.getAllWindowHandles();
		assert.equal(windows.length, 2);
		let mainWindow = await driver.getWindowHandle();
		let popupWindows = windows.filter(handle => handle !== mainWindow);
		assert.equal(popupWindows.length, 1);
	});
});

