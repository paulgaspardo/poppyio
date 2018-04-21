import { Matcher, MatchOption, Session } from "../core/common";
import { connectSOAP, moveAspectsUp } from './common';

export { offerObject as default }

export function offerObject(to: Matcher|Session, args: OfferObjectArgs): Promise<AcceptedObjectOffer|undefined> {
	return beginOfferObject(to, args).then(offer => {
		if (!offer) return Promise.resolve(undefined);
		try {
			return Promise.resolve(
				typeof args.post === 'function'
				? args.post(offer)
				: args.post
			).then(post => {
				return offer.resolve(post).then(accepted => {
					if (accepted) return Promise.resolve(accepted);
					return Promise.reject(Error('Protocol error: no response'));
				});
			});
		} catch (e) {
			offer.session.cancel();
			return Promise.reject(e);
		}
	});
}


export function beginOfferObject(to: Matcher|Session, args: BeginOfferObjectArgs): Promise<ObjectOffer|undefined> {
	return connectSOAP(to, args, 'offer').then(session => {
		if (!session) return Promise.resolve(undefined);
		let resolved: Promise<AcceptedObjectOffer>|undefined = undefined;
		let resolve = (data?: any, transfer?: any[]) => {
			if (resolved) return resolved;
			if (transfer) session.port.postMessage(data, transfer)
			else session.port.postMessage(data);
			return resolved = new Promise((resolve, reject) => {
				session.port.onmessage = (ev: MessageEvent) => {
					let accepted: AcceptedObjectOffer = {
						data: ev.data,
						ports: ev.ports
					}
					moveAspectsUp(accepted);
					resolve(accepted);
				};
				session.closed.then(() => {
					reject(new Error('Session closed before acknowlegded'));
				});
			});
		}
		return Promise.resolve({
			session,
			origin: session.origin,
			kind: session.offering!,
			hint: session.hint,
			resolve
		});
	});
}

export interface OfferObjectArgs extends BeginOfferObjectArgs {
	kind: string|string[];
	hint?: any;
	post: any|((offer: ObjectOffer)=>any)|Promise<any>|((offer: ObjectOffer)=>Promise<any>);
}

export interface BeginOfferObjectArgs {
	kind: string|string[];
	hint?: any;
}

export interface ObjectOffer {
	session: Session,
	origin: string;
	kind: string;
	hint?: any;
	resolve(data?: any, transfer?: any[]): Promise<AcceptedObjectOffer|undefined>;
}

export interface AcceptedObjectOffer {
	data?: any;
	ports?: ReadonlyArray<MessagePort>;
	[aspect:string]:any;
}
