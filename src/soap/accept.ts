import { Matcher, MatchOption, Session } from "../core/common";
import { connectSOAP, moveAspectsUp } from "./common";

export { acceptObject as default }

/**
 * Accepts an object via Simple Offer/Accept Protocol from a peer.
 * 
 *  - Resolves to an AcceptedObject if an object was successfully accepted. The
 *    session may still be open after this function resolves.
 *  - Resolves to nothing if a session was never established.
 * 
 *  - Will reject if the session is closed before we are able to reply, even if
 *    we did not reply with any value. Will reject on protocol and other errors.
 * 
 * A value to reply with may be provided via the args.reply option.
 * 
 * @param from Session, Dialog or Opener to accept the object from
 * @param args Request details
 */
export function acceptObject(from: Session|Matcher, args: AcceptObjectArgs): Promise<AcceptedObject|undefined> {
	return beginAcceptObject(from, args).then(acceptedObject => {
		// Not an error, session never established.
		if (!acceptedObject) {
			return Promise.resolve(undefined);
		}
		try {
			// Turn args.reply into a value to hand off to acceptedObject.resolve().
			// Note if reply is a function it may call acceptedObject.resolve()
			// itself so whatever value is returned is basically ignored.
			let replyValuePromise = Promise.resolve(
				typeof args.reply === 'function'
				? args.reply(acceptedObject)
				: args.reply);
			return replyValuePromise.then(replyValue => {
				return acceptedObject.resolve(replyValue).then(success => {
					if (success) return Promise.resolve(acceptedObject);
					return Promise.reject(Error('incomplete'));
				});
			});
		} catch (e) {
			// reject if args.reply throws
			acceptedObject.session.cancel();
			return Promise.reject(e);
		}
	});
}

/**
 * Accepts an object from a peer via Simple Offer/Accept Protocol but doesn't
 * complete the exchange and send a reply to the peer until the resolve() method
 * on the returned AcceptedObject is called (with optional response data)
 * 
 *  - Resolves with an AcceptedObject if the peer sent an object message to us.
 *  - Resolves to nothing if a session is never established.
 * 
 *  - Will reject on protocol and other errors.
 * 
 * @param from Session, Dialog or Opener to accept the object from
 * @param args Request details
 */
export function beginAcceptObject(from: Session|Matcher, args: BeginAcceptObjectArgs): Promise<AcceptedObject|undefined> {
	return connectSOAP(from, args, 'accept').then(session => {
		// Not an error, session never established.
		if (!session) {
			return Promise.resolve(undefined);
		}
		let receivedObjectFromPeer: boolean = false;
		return new Promise<AcceptedObject>((resolveReceived, rejectReceived) => {
			let sentReplyToPeer: boolean = false;
			let donePromise = new Promise<boolean>(resolveDone => {
				session.port.onmessage = (ev: MessageEvent) => {
					if (!receivedObjectFromPeer) {
						// Received first message with object data from the peer.
						receivedObjectFromPeer = true;
						let accepted: AcceptedObject = {
							session,
							origin: session.origin,
							kind: session.accepting!,
							hint: session.hint,
							matchlist: session.matchlist,
							data: ev.data,
							ports: ev.ports,
							resolve(data, transfer): Promise<boolean> {
								if (!sentReplyToPeer) {
									sentReplyToPeer = true;
									session.port.postMessage(data, transfer || []);
								}
								return donePromise;
							}
						}
						moveAspectsUp(accepted);
						resolveReceived(accepted);
					} else {
						// Received second and final message acknowledging the reply
						// was received and it is safe to close.
						resolveDone(true);
						session.release();
						return;
					}
				};
				// Resolve promises if the session is closed before receiving all
				// messages
				session.closed.then(() => {
					rejectReceived(Error('Did not receive object'));
					// We will not treat it as an error if the session is closed
					// after we sent a reply even if we did not get acknowledgement
					// of the reply.
					if (sentReplyToPeer) resolveDone(true);
					else resolveDone(false);
				});
			});
		});
	});
}

/**
 * Optinos for acceptObject()
 */
export interface AcceptObjectArgs extends BeginAcceptObjectArgs {
	/**
	 * The kinds of objects (and also names of protocols as they are the same thing
	 * for SOAP) we can accept.
	 */
	kind: string|string[];

	/**
	 * Hint data to refine filtering and indicate supported functionality.
	 */
	hint?: any;

	/**
	 * What to reply to the peer with. This may be:
	 * 
	 *   - A data value.
	 *   - A promise that resolves to a data value.
	 *   - A function that returns a data value.
	 *   - A function that returns a promise that resolves to a data value.
	 *   - A function that sends a reply to the peer by calling the resolve()
	 *     method on the AcceptedObject. This allows you to send MessagePorts
	 *     and other transferrable objects back to the peer.
	 * 
	 * Functions will receive an AcceptedObject parameter. If you opt to send
	 * data by calling the resolve method on the AcceptedObject you must do so
	 * synchonously or return a promise that resolves after the the call (the
	 * value it resolves to is ignored, but it must resolve).
	 * 
	 * If the function throws an error or the promise rejects then the acceptObject()
	 * call will reject with the same reason.
	 */
	reply?: any|PromiseLike<any>|((accepted:AcceptedObject)=>any)|((accepted:AcceptedObject)=>PromiseLike<any>);
}

/**
 * Options for beginAcceptObject()
 */
export interface BeginAcceptObjectArgs {
	/**
	 * The kinds of objects (and also names of protocols as they are the same thing
	 * for SOAP) we can accept.
	 */
	kind: string|string[];

	/**
	 * Hint data to refine filtering and indicate supported functionality.
	 */
	hint?: any;
}

/**
 * The object accepted from the Peer.
 * For convenience any values with keys in the data object that contain a 
 * colon (:) indicating that they may be URIs or that start with a capital
 * letter indicating an Amalgam aspect type are copied to the AcceptedObject.
 * 
 * So for example accepted.data.File is also available as accepted.File.
 *
 */
export interface AcceptedObject {

	/**
	 * The session the exchange was performed within. You may find it useful to
	 * wait for session.closed to resolve after you accept the object to detect
	 * when the Poppy is closed.
	 */
	session: Session;

	/**
	 * Object data the peer sent to us. Any properties in the object that begin
	 * with a capital ASCII letter ([A-Z]) or colon (:) are also copied to the
	 * AcceptedObject directly.
	 */
	data?: any;

	/**
	 * Index sigature for the copied values from the data property.
	 */
	[aspect:string]: any;

	/**
	 * MessagePorts received from the pere
	 */
	ports: ReadonlyArray<MessagePort>;

	/**
	 * The kind of object (and negotiated protocol) accepted from the peer.
	 */
	kind: string;

	/**
	 * Hint received from the peer
	 */
	hint?: any;

	/**
	 * Matchlist sent by the peer.
	 */
	matchlist: MatchOption|MatchOption[];

	/**
	 * Origin of the peer
	 */
	origin: string;

	/**
	 * Send a reply to the peer. As with resolving a promise, if this function is
	 * called more than once only the first call will have an effect. All calls
	 * will return the same promise.
	 * 
	 *   - Resolves to true after a reply is sent and we recieved acknowledgement
	 *     from the peer.
	 *   - Resolves to true if a reply was sent and the session is closed before
	 *     we received an acknowlegement.
	 *   - Resolves to false if we were not able to send a reply before the 
	 *     session was closed.
	 *   - Should not reject.
	 * 
	 * @param data object data to send
	 * @param transfer transfer list (for transferrable objects such as Message Ports).
	 */
	resolve(data: any, transfer?: any[]): Promise<boolean>;

}
