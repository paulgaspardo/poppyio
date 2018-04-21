const esprima = require('esprima');
const escodegen = require('escodegen');

// used to add .mjs into import declarations when emitting ES6 modules from TypeScript
// ...and then remove them again when turning them into ES5.
module.exports = (sourceString, transform) => {
	let parsed = esprima.parseModule(sourceString, {range: true, tokens: true, comment: true});
	parsed.body.forEach(node => {
		if (node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportAllDeclaration')
			return;
		if (!node.source || !node.source.value) {
			return;
		}
		node.source.value = transform(node.source.value);
	});
	parsed = escodegen.attachComments(parsed, parsed.comments, parsed.tokens);
	return escodegen.generate(parsed, {
		comment: true
	});
};
