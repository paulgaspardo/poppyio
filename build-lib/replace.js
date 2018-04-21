// Replace all occurences of replacementMap keys in input with the values
module.exports = (input, replacementsMap) => {
	let output = input;
	for (key in replacementsMap) {
		output = output.split(key).join(replacementsMap[key]);
	}
	return output;
}
