import { Session, Matcher, MatchOption } from "../core/common";
import { match } from "../../node_modules/@types/minimatch/index";

/**
 * Turn BeginAcceptObjectArgs/BeginOfferObjectArgs into a matchlist and establish a
 * connection, or if we are connecting to an already open session verify there
 * is a protocol match.
 * 
 * @param connectTo Session or SessionRequester to connect to 
 * @param args The Args object passed to the function.
 * @param side Whether we are accepting or offering.
 */
export function connectSOAP(connectTo: Session|Matcher, kinds: Kinds, side:'accept'|'offer'): Promise<Session|undefined> {
	if (!kinds) return Promise.reject(Error("No kind specified"));
	
	let matchlist: MatchOption[] = [];
	let filesMatchInList = false;
	let filesMatch = {
		[side]: 'File',
		hint: {
			types: [] as string[]
		}
	};

	if (Array.isArray(kinds)) {
		kinds.forEach(kind => {
			if (isFileType(kind)) {
				if (!filesMatchInList) {
					matchlist.push(filesMatch);
					filesMatchInList = true;
				}
				filesMatch.hint.types.push(kind);
			} else {
				matchlist.push({
					[side]: kinds
				});
			}
		});
	} else {
		if (typeof kinds === 'string') {
			if (isFileType(kinds)) {
				filesMatch.hint.types.push(kinds);
				matchlist.push(filesMatch);
				filesMatchInList = true;
			} else {
				matchlist.push({
					[side]: kinds
				});
			}
		} else {
			let actualKinds = Array.isArray(kinds.kind) ? kinds.kind : [kinds.kind];
			actualKinds.forEach(kind => {
				if (isFileType(kind)) {
					if (!filesMatchInList) {
						matchlist.push(filesMatch);
						filesMatchInList = true;
						if ('hint' in kinds) {
							filesMatch.hint = kinds.hint;
							filesMatch.hint.types = [];
						}
					}
					filesMatch.hint.types.push(kind);
				} else {
					let hint: any = {};
					if ('hint' in kinds) {
						hint = kinds.hint;
					} else {
						Object.keys(kinds).forEach(key => {
							if (key !== 'kind') hint[key] = (kinds as any)[key];
						});
					}
					matchlist.push({
						[side]: kinds
					});
				}
			});
		}
	}
	let protocols: string[] = matchlist.map(match => match[side]!);
	// If connectTo is a PoppySession we check if it's a match.
	if ('port' in connectTo && !('request' in connectTo)) {
		if (!protocols.some(p => side === 'accept' && p === connectTo.accepting || side === 'offer' && p === connectTo.offering)) {
			return Promise.reject(Error('Session match failed'));
		}
		if (connectTo.port.onmessage) {
			return Promise.reject('already an onmessage listener on the port');
		}
		return Promise.resolve(connectTo);
	}
	// // Otherwise connectTo.request() does the matching.
	// let matchlist: MatchOption[] = protocols.map(p => ({
	// 	hint: args.hint,
	// 	[side]: p
	// }));
	return connectTo.match(matchlist);
}

/**
 * Move data properties up to the parent object if their property names begin
 * with a capital letter or contain a colon.
 */
export function moveAspectsUp(amalgam: {data?:any, [key:string]:any}): void {
	if (amalgam.data) {
		for (let key in amalgam.data) {
			if (key.match(/^[A-Z]|\:/)) amalgam[key] = amalgam.data[key];
		}
	}
}

export type Kinds = string|string[]|{kind:string|string[], [key:string]:any}|{kind:string|string[], hints:any}

function isFileType(kind: string) {
	return kind.match(/^[a-zA-Z]+\//) || kind.indexOf(".") === 0;
}
