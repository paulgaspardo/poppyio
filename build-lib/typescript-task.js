// The TypeScript compiler
// based on https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API

const ts = require('typescript');
const fs = require('fs');
const modifyImports = require('./modify-imports');
const io = require('./io');

const files = {};

function typescriptTask (output, inputs, transform) {
	if (!output.endsWith('.mjs')) {
		throw new Error('must output .mjs'); // at least for our purposes
	}
	files[inputs[0]] = 0;
	return file(output, inputs, () => {
		compileTypescript(inputs[0], transform);
	});
}
module.exports = typescriptTask;

const languageService = ts.createLanguageService({
	getScriptFileNames: () => Object.keys(files),
	getScriptVersion: (name) => files[name] && files[name].toString(),
	getScriptSnapshot: (name) => {
		if (!fs.existsSync(name)) return undefined;
		let contents = fs.readFileSync(name, 'utf-8');
		return ts.ScriptSnapshot.fromString(contents);
	},
	getCurrentDirectory: () => process.cwd(),
	getCompilationSettings: () => ({
		strictNullChecks: true,
		noImplicitAny: true,
		noImplicitReturns: true,
		outDir: "target",
		noEmitHelpers: true,
		declaration: true,
		module: ts.ModuleKind.ES2015,
		lib: ["lib.es2015.d.ts", "lib.dom.d.ts"],
		target: ts.ScriptTarget.ES2015,
		removeComments: false
	}),
	getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
	fileExists: ts.sys.fileExists,
	readFile: ts.sys.readFile,
	readDirectory: ts.sys.readDirectory
}, ts.createDocumentRegistry());

function compileTypescript(fileName, transform) {
	console.log(`[typescript] ${fileName}`);
	files[fileName]++;
	let output = languageService.getEmitOutput(fileName);
	if (output.emitSkipped) {
		console.error(`   error: emitting ${fileName} failed`);
	}
	let allDiagnostics = languageService.getCompilerOptionsDiagnostics()
		.concat(languageService.getSyntacticDiagnostics(fileName))
		.concat(languageService.getSemanticDiagnostics(fileName));
	allDiagnostics.forEach(diagnostic => {
		let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
		if (diagnostic.file) {
			let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			console.error(`  error: ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
		}
		else {
			console.error(`  error: ${message}`);
		}
	});
	output.outputFiles.forEach(o => {
		// console.log(`   write: ${o.name}`)
		let name = o.name;
		let output = o.text;
		if (o.name.endsWith('.js')) {
			// TypeScript only outputs .js but we want .mjs
			name = name.replace('.js', '.mjs');
			output = modifyImports(output, name => name + '.mjs');
		}
		if (transform) {
			output = transform(name, output) || output;
		}
		io.write(name, output);
	});
}
