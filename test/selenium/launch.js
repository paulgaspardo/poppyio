const listen = require('../lib/server');
const { Builder, By } = require('selenium-webdriver');
const assert = require('assert');
const { env } = require('process');

describe('Launch page', () => {
	let server;
	let driver;
	let baseUrl;

	before(() => {
		server = listen();
		baseUrl = 'http://localhost:' + server.address().port;
	});
	after(() => {
		server.close();
		driver.quit();
	});
	beforeEach(() => {
		driver = new Builder().forBrowser(process.env.BROWSER || 'chrome').build();
	});
	afterEach(() => {
		driver.close();
	});

	it('Opens', async function () {
		this.timeout(10000);
		let windows = await driver.getAllWindowHandles();
		assert.equal(windows.length, 1);
		await driver.navigate().to(baseUrl + '/test/pages/readme_example.html');
		await driver.findElement(By.id('pickButton')).click();
		windows = await driver.getAllWindowHandles();
		assert.equal(windows.length, 2);
		let mainWindow = await driver.getWindowHandle();
		let popupWindows = windows.filter(handle => handle !== mainWindow);
		assert.equal(popupWindows.length, 1);
	});
});

