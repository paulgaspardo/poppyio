const fs = require('fs');
const typescriptTask = require('./build-lib/typescript-task');
const rollup = require('rollup');
const modifyImports = require('./build-lib/modify-imports');
const toml = require('toml');
const UglifyJs = require('uglify-js');
const glob = require('glob');
const ts = require('typescript');
const { read, write } = require('./build-lib/io');
const replace = require('./build-lib/replace');
const minify = require('html-minifier').minify;

// Required output directories
const outputDirectories = ['target/bundle']
	.concat(glob.sync('src/**/').map(name => name.replace('src/','target/')))
	.concat(glob.sync('src/**/').map(name => name.replace('src/','target/amd/')));
outputDirectories.forEach(directory);

// Input files
// Note files with "$" in the name are all templates for localized modules

const compiledModules = (glob.sync('src/**/*.ts')
	.filter(name => name.indexOf('$') === -1 && !name.endsWith('.d.ts'))
	.map(name => name.replace('.ts', '').replace('src/','')));

const typeDeclarationFiles = glob.sync('src/**/*.d.ts')
	.filter(name => name.indexOf('$') === -1)
	.map(name => name.replace('src/',''));

const mjsFiles = glob.sync('src/**/*.mjs')
	.filter(name => name.indexOf('$') === -1)
	.map(name => name.replace('src/',''));

const copiedSrcFiles = glob
	.sync('src/**/*.d.ts')
	.concat(glob.sync('src/**/*.mjs'))
	.filter(name => name.indexOf('$') === -1)
	.map(name => name.replace('src/',''));

const bundleEntrypoints = fs.readdirSync('./src/bundle');

const langTags = fs.readdirSync('./strings').map(name => name.replace('.toml',''));

// Task Definitions

task('clean', () => jake.rmRf('target'));
task('rebuild', ['clean', 'default']);
task('default', [].concat(
	outputDirectories,
	'target/package.json',
	'target/README.md',
	'target/LICENSE',
	// Note: all .js modules are generated from .mjs files via the ES6->ES5 rule.
	// AMD versions aren't mentioned here but also get generated in the amd/ tree.
	// Compile .ts -> .mjs -> .js
	compiledModules.map(name => `target/${name}.js`),
	// Copy all copiedFiles
	copiedSrcFiles.map(name => `target/${name}`),
	['target/launch/nacl/crypto_sign_open.js','target/launch/nacl/crypto_sign_open.d.ts'],
	// Localized files
	langTags.map(tag => `target/strings-${tag}.js`),
	langTags.map(tag => `target/strings-${tag}.d.ts`),
	langTags.map(tag => `target/use-${tag}.js`),
	langTags.map(tag => `target/use-${tag}.d.ts`),
	langTags.map(tag => `target/bundle/poppyio.add.${tag}.js`),
	langTags.map(tag => `target/bundle/poppyio.${tag}.js`),
	// Base (non-localized) bundles
	bundleEntrypoints.map(name => `target/bundle/${name}`),
	// .min.js files not mentioned but also get generated for all bundle/ files.
	// (except for the add.${tag}.js files which are pretty small already)
));

// Before watching do an incremental build
task('watch', ['default', 'just-watch']);
watchTask('just-watch', ['default'], function () {
	this.throttle = 0;
	this.watchFiles.include([
		'src/**',
		'strings/**',
		'package.json',
		'README.md'
	]);
});

// The README
// Remove everything until after the first horizontal line
file('target/README.md', ['README.md', 'package.json'], () => {
	let sourceReadme = read('README.md');

	// Verify version URLs in README match actual version
	let version = JSON.parse(read('package.json')).version;
	sourceReadme.match(/js\.poppy\.io\/[0-9a-z\.\-]+/g).forEach(versionedLink => {
		if (versionedLink !== 'js.poppy.io/' + version) {
			throw Error(`URL ${versionedLink} doesn't have the right version`);
		}
	});
	
	let endOfLine = sourceReadme.indexOf('------\n');
	write('target/README.md', sourceReadme.substr(endOfLine + 7));
});

// Compile typescript modules
const extraDependenciesForTypescriptModules = {
	'index': ['package.json'], // version information
	'launch/starter': ['src/launch/starter.html'] // inject HTML
}
compiledModules.forEach(name => {
	typescriptTask(`target/${name}.mjs`, [`src/${name}.ts`].concat(extraDependenciesForTypescriptModules[name] || []), (name, output) => {
		// Insert version information
		if (name.endsWith('target/index.mjs')) {
			return output.replace('$Version$', JSON.parse(read('package.json')).version);
		}
		// Insert dialog HTML
		if (name.endsWith('starter.mjs')) {
			let html = read('src/launch/starter.html');
			let minified = minify(html, {
				collapseWhitespace: true,
				removeAttributeQuotes: true,
				removeComments: true
			});
			return output.replace('$DialogHtml$', JSON.stringify(minified));
		}
	});
});

// Copy non-compiled files from src/ to target/
copiedSrcFiles.forEach(name => {
	file(`target/${name}`, [`src/${name}`], () => {
		jake.cpR(`src/${name}`, `target/${name}`);
	});
});

// LICENSE
file('target/LICENSE', ['LICENSE'], () => {
	jake.cpR('LICENSE', 'target/LICENSE');
});

// ES6 modules -> ES5 modules
rule(/\.js$/, '.mjs', function () {
	// Remove .mjs from ES6 import paths (inserted so they can work in browsers)
	let es6 = modifyImports(read(this.source), n => n.replace('.mjs', ''));
	// CommonJS - .js file next to .mjs
	let cjs = ts.transpileModule(es6, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	write(this.name, cjs);
	// AMD - .js file in amd/ subtree
	let amd = ts.transpileModule(es6, { compilerOptions: { module: ts.ModuleKind.AMD } }).outputText;
	write(this.name.replace('target/', 'target/amd/'), amd);
});

bundleEntrypoints.forEach(name => {
	file(`target/bundle/${name}`, compiledModules.map(name => `target/${name}.mjs`).concat(`src/bundle/${name}`), async () => {
		await makeBundle('src/bundle/' + name, 'target/bundle/' + name);
	});
})
async function makeBundle(entrypoint, outputFile) {
	// First rollup ES6 then transpile to ES5
	let rolledup = await rollup.rollup({
		input: entrypoint
	});
	let { code } = await rolledup.generate({
		format: 'iife',
		name: 'poppyio',
		intro: 'function __extends(D, B) { D.prototype = Object.create(B.prototype); D.prototype.constructor = D.constructor; }'
	});
	let es5 = ts.transpileModule(code, {
		compilerOptions: {
			module: ts.ModuleKind.None,
			noEmitHelpers: true
		}
	}).outputText;

	// Append Promise polyfill
	let promiscuous = read(require.resolve('promiscuous'))
		.replace('module.exports', 'window.Promise')
		.replace('setImmediate', '(window.setImmediate||setTimeout)');
	es5 += 'if (typeof Promise === "undefined"){\n'+promiscuous+'}';

	write(outputFile, es5);

	// Minify
	let minified = UglifyJs.minify(es5, {
		output: {
			comments: /@license/
		}
	});
	if (minified.error) {
		console.error('Error minifying: ' + minified.error);
	}
	write(outputFile.replace('.js', '.min.js'), minified.code);
}

// Copy version to package.json
file('target/package.json', ['src/package.json', 'target', 'package.json'], () => {
	let version = JSON.parse(read('package.json')).version;
	let template = JSON.parse(read('src/package.json'));
	template.version = version;
	write('target/package.json', JSON.stringify(template, undefined, 2));
	write('target/bower.json', JSON.stringify({ name: "poppyio" }, undefined, 2));
});

// Generate localized files
langTags.forEach(langTag => {
	// $LangSym$ is $LangTag$ with '-' replaced with '_' to be usable as a JavaScript name
	let langSym = langTag.replace('-', '_');
	// strings-[lang] modules contain strings from strings/[lang].toml files
	file(`target/strings-${langTag}.mjs`, [`strings/${langTag}.toml`, 'src/strings-$LangTag$.mjs'], () => {
		let strings = toml.parse(read(`strings/${langTag}.toml`));
		if (strings.lang !== langTag) {
			throw new Error(`strings filename ${langTag} doesn't match ${strings.lang}`);
		}
		write(`target/strings-${langTag}.mjs`, replace(read('src/strings-$LangTag$.mjs'), {
			$LangSym$: langSym,
			$LangTag$: langTag,
			$Strings$: JSON.stringify(strings, undefined, 2)
		}));
	});
	file(`target/strings-${langTag}.d.ts`, [`src/strings-$LangTag$.d.ts`], () => {
		write(`target/strings-${langTag}.d.ts`, replace(read('src/strings-$LangTag$.d.ts'), {
			$LangSym$: langSym,
			$LangTag$: langTag
		}));
	});
	// use-[lang] modules install strings and set up base Poppy DialogOpener to use
	// embedded launcher
	file(`target/use-${langTag}.mjs`, [`src/use-$LangTag$.mjs`], () => {
		write(`target/use-${langTag}.mjs`, replace(read('src/use-$LangTag$.mjs'), {
			$LangSym$: langSym,
			$LangTag$: langTag
		}));
	});
	file(`target/use-${langTag}.d.ts`, [`src/use-$LangTag$.d.ts`], () => {
		write(`target/use-${langTag}.d.ts`, replace(read('src/use-$LangTag$.d.ts'), {
			$LangSym$: langSym,
			$LangTag$: langTag
		}));
	});
	// The self-contained poppyio.[lang].js bundles
	file(`target/bundle/poppyio.${langTag}.js`, [`target/bundle/poppyio.js`, `target/bundle/poppyio.add.${langTag}.js`], () => {
		let bundle = read('target/bundle/poppyio.js');
		let bundleMin = read('target/bundle/poppyio.min.js');
		let add = `poppyio.Poppy.base.lang="${langTag}";` + read(`target/bundle/poppyio.add.${langTag}.js`);
		write(`target/bundle/poppyio.${langTag}.js`, bundle + add);
		write(`target/bundle/poppyio.${langTag}.min.js`, bundleMin + add);
	});
	// poppyio.add.[lang].js bundle files to add additional languages to 
	file(`target/bundle/poppyio.add.${langTag}.js`, [`strings/${langTag}.toml`, `target/bundle/poppyio.js`], () => {
		let strings = toml.parse(read(`strings/${langTag}.toml`));
		write(`target/bundle/poppyio.add.${langTag}.js`, `poppyio.Poppy.base.strings.push(poppyio.${langSym}=${JSON.stringify(strings)});`);
	});
});
