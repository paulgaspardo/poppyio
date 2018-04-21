const fs = require('fs');

// read/write functions

const writeCache = {};

function read(name) {
	if (writeCache[name]) return writeCache[name];
	return fs.readFileSync(name, 'utf-8');
}
function write(name, contents) {
	writeCache[name] = contents;
	fs.writeFileSync(name, contents, 'utf-8');
}

exports.read = read;
exports.write = write;
