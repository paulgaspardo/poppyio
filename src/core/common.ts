
/**
 * A Connection to a peer webpage.
 * 
 * If you're a client, that means a poppy service that's been opened up in a
 * [[Dialog]]. If you're a poppy service, that means the client page that
 * opened you. Armed with a `MessagePort` (see [[Session.port]]) and
 * matching protocol (see [[Session.accepting]] and [[Session.offering]])
 * you should have everything you need to establish a connection. And if it turns
 * out you don't and need to bail, there's always [[Session.cancel]].
 * 
 * You get one of these from a [[Matcher]] - a [[Dialog]] or
 * [[DialogOpener]] on the client side or [[ServiceRequest]] on the poppy side - by
 * calling the [[Matcher.match]] method.
 * 
 * It's called a "session" and not a "connection" because it may stay open
 * after you finish your exchange and are effectively disconnected. The general
 * rule is the poppy closes the session since the poppy has control over the UI,
 * so if you're the client all you do is wait until that happens (you can use
 * the [[Session.closed]] promise for that).
 * 
 * That's also why there's a [[Session.cancel]] method instead of a `close()`. Closing the
 * session is basically what `cancel()` does, but you're generally not supposed to
 * call it unless something bad happens.
 * 
 * Note that the "poppy closes the session" rule still applies if the poppy is the
 * one to cancel.
 * 
 * But you still should indicate you're done somehow. That's what the [[Session.release]]
 * method is for. It's effectively a no-op right now but should come in handy
 * if direct client-to-client connections are implemented - in that case there's
 * no poppy to drive the UI so one of the clients needs to say the session is
 * ready to be closed. Note only *one* client should do that--which one should
 * be defined based on the protocol being used.
 */
export interface Session {
	/** The `MessagePort` to talk to the peer with */
	port: MessagePort;

	/** The thing that created us */
	opener?: Matcher;

	/** The origin of the peer */
	origin: string;

	/** What we're accepting from the peer, if we're accepting */
	accepting?: string;

	/** What we're offering the peer, if we're offering */
	offering?: string;

	/** The hint the peer provided to us for our match */
	hint?: object;

	/** The full matchlist sent to us by the peer */
	matchlist: MatchOption[];

	/** A promise that resolves after the session is closed. */
	closed: Promise<undefined>;

	/** Forcibly close the session */
	cancel(): void;

	/** A "soft" close to signal the primary exchange is done */
	release(): void;
}


/**
 * Where [[Session]]s are born.
 * 
 * Implemented by [[Dialog]] and
 * [[DialogOpener]] on the client side, and [[ServiceRequest]] on the service side.
 * 
 * You use this interface to open up a connection to a peer with Poppy I/O. If
 * you're a client this will open up a popup window to host the poppy (or use
 * an already-open window). If you're a poppy service this will connect to the
 * client that opened you.
 */
export interface Matcher {

	/**
	 * Connect to a peer. This resolves with a [[Session]] if something on your
	 * matchlist and the peer's match and a connection is established.
	 * 
	 * If there isn't a match and it's being called from a client, then it will
	 * resolve to nothing. It's not considered an error in that case since it
	 * means either ther user cancelled before a poppy could be opened, or a poppy
	 * was opened and decided it couldn't fulfill the request, in which case the
	 * poppy should have told the that.
	 * 
	 * If there isn't a match and you're a service then it does reject, because
	 * you really should know better given you get a whole matchlist from the
	 * client telling you what they support, it's up to you to figure out whether
	 * or not you can handle it. If you can't just tell the user and don't even
	 * try to connect.
	 * 
	 * Other reasons it may reject are that it was invoked when it shouldn't be
	 * (e.g. on an already-connected or closed `Dialog`) or if the matchlist
	 * is invalid. See [[validateMatchlist]] for reasons why that would be the case.
	 * 
	 * A [[Matcher]] may or may not let you use it to connect more than
	 * once - [[Dialog]]s and [[ServiceRequest]]s won't, but [[DialogOpener]]s will.
	 * 
	 * @param matchlist a list of things you want to do, to match against what
	 *                  a peer can do for you.
	 */
	match(matchlist: MatchOption|MatchOption[]): Promise<Session|undefined>;

}

/**
 * Indicates what a peer supports
 * 
 * To establish a connection over Poppy I/O both sides start with one of these
 * (or a whole list of them). They indicate what protocol a peer supports, which
 * side of a protocol it can assume, and an optional hint to indicate additional
 * capabilities or further refine what the peer hopes to accomplish.
 * 
 * Clients send these off to the [[Matcher.match]] method; the
 * service at the other end looks through the list for a match, and if there is one calls
 * [[ServiceRequest.match]] or [[ServiceRequest.connect]] to establish
 * a connection.
 * 
 * A `MatchOption` must have an accept or an offer, and not both, but a matchlist
 * can have accept and offers for the same protocol, just in different
 * MatchOption objects. See the [[validateMatchlist]] function for more on that.
 * This is for protocols where it doesn't logically matter which side is which;
 * one peer will get the `accept` side and the other the `offer` side to keep
 * everything in order.
 */
export interface MatchOption {
	/**
	 * A protocol a peer is accepting. If set, then the offer option must not be.
	 * And if this is not set, the offer option must be.
	 */
	accept?: string;
	/**
	 * A protocol a peer is offering. If set, then the offer option must not be.
	 * And if this is not set, the offer option must be.
	 */
	offer?: string;
	/**
	 * Used for indicating extra capabilities and helping filter out
	 * inappropriate options.
	 */
	hint?: object;
}

/**
 * Validates a matchlist
 * 
 * As the name implies. If the matchlist is invalid it
 * throws a `TypeError`. If it is valid, it returns a brand new matchlist with
 * a copy of all the MatchOptions passed in.
 * 
 * What makes a matchlist valid?
 * 
 * * Each object in the matchlist must be an object (and not like a string or something).
 * * Each object in the matchlist must have exactly one of {accept, offer} be
 *   set to a string value indicating its "accept" or "offer" protocol
 * * Each "accept" protocol can only appear once as an "accept" protocol, and
 *   likewise each "offer" protocol may only appear once as an "offer" protocol.
 * * However, An "accept" protocol may appear as an "offer" protocol in a separate
 *   MatchOption, in case the protocol doesn't have an obvious "accept" or "offer"
 *   side.
 * 
 * @param matchlist A matchlist to validate.
 */
export function validateMatchlist(matchlist: MatchOption|MatchOption[]|any): MatchOption[] {
	if (!Array.isArray(matchlist)) matchlist = [matchlist];
	// Keep track of whether a protocol has appeared as an accept or offer before
	// to make sure there aren't duplicates.
	let accepting: {[key:string]:number} = {};
	let offering: {[key:string]:number} = {};
	return matchlist.map((matchOption: any) => {
		// A MatchOption must be an object
		if (typeof matchOption !== 'object' || Array.isArray(matchOption)) throw TypeError('Poppy.io: match-not-an-object');
		// Only one of {accept, offer} may be defined
		if (typeof matchOption.accept !== 'undefined' && typeof matchOption.offer !== 'undefined') {
			throw TypeError('Poppy.io: both-accept-and-offer');
		}
		let hasAccept = typeof matchOption.accept === 'string';
		let hasOffer = typeof matchOption.offer === 'string';
		if (hasAccept) {
			// You can only accept a protocol once
			if (matchOption.accept in accepting) {
				throw TypeError('Poppy.io: duplicate-accept');
			}
			accepting[matchOption.accept] = 1;
			return {
				accept: matchOption.accept,
				hint: matchOption.hint
			};
		} else if (hasOffer) {
			// You can only offer a protocol once
			if (matchOption.offer in offering) {
				throw TypeError('Poppy.io: duplicate-offer');
			}
			offering[matchOption.offer] = 1;
			return {
				offer: matchOption.offer,
				hint: matchOption.hint
			}
		} else {
			// You have to accept or offer something.
			throw TypeError('Poppy.io: missing-accept-or-offer');
		}
	});
}
