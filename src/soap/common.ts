import { Session, Matcher, MatchOption } from "../core/common";

/**
 * Turn BeginAcceptObjectArgs/BeginOfferObjectArgs into a matchlist and establish a
 * connection, or if we are connecting to an already open session verify there
 * is a protocol match.
 * 
 * @param connectTo Session or SessionRequester to connect to 
 * @param args The Args object passed to the function.
 * @param side Whether we are accepting or offering.
 */
export function connectSOAP(connectTo: Session|Matcher, args: {kind:string|string[],hint?:any}, side:'accept'|'offer'): Promise<Session|undefined> {
	if (!args || !args.kind) return Promise.reject(Error('Missing protocol'));
	let protocols: string[] = Array.isArray(args.kind) ? args.kind : [args.kind];
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
	// Otherwise connectTo.request() does the matching.
	let matchlist: MatchOption[] = protocols.map(p => ({
		hint: args.hint,
		[side]: p
	}));
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
