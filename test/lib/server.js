const express = require('express');
const path = require('path');

function serve() {
	let app = express();
	app.use(express.static(path.join(__dirname, '..', '..')));
	return app.listen(0);
}

module.exports = serve; 

if (module === require.main) {
	let server = serve();
	console.log(__dirname);
	console.log('Listening on ' + server.address().port);
}
