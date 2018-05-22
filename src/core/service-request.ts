import { MatchOption, Matcher, Session, validateMatchlist } from "./common";
export { ServiceRequest as default }

export type ServiceRequestState = 'unopened' | 'opened' | 'matching' | 'connected' | 'complete' | 'closed';

/**
 * A request recieved by a Poppy I/O service.
 */
export class ServiceRequest implements Matcher {
	static received?: ServiceRequest;

	trigger: MessageEvent;
	state: ServiceRequestState;
	matchlist: MatchOption[];
	session: Session;
	launch?: any;

	constructor(trigger: MessageEvent, matchlist: MatchOption[], launch?: any) {
		this.state = 'opened';
		this.trigger = trigger;
		this.matchlist = matchlist;
		this.launch = launch;
	}

	open() {
		return this;
	}

	accepting(protocol: string): boolean {
		return this.matchlist.some(p => p.accept === protocol);
	}

	offering(protocol: string): boolean {
		return this.matchlist.some(p => p.offer === protocol);
	}

	authorize(origins: string[]) {
		if (window.opener) window.opener.postMessage({
			'https://poppy.io/a/to-client': {
				origins: origins
			}
		}, '*');
	}

	/**
	 * 
	 * 
	 * @param matchlist Matchlist. Verified that all elements match something
	 *                  the client requested.
	 */
	commit(matchlist: MatchOption|MatchOption[]): Session|undefined {
		try {
			if (this.state !== 'opened') throw Error('invalid state: ' + this.state);
			let validMatchlist = validateMatchlist(matchlist);
			let myMatch: MatchOption|undefined = undefined;
			let theirMatch: MatchOption|undefined = undefined;
			validMatchlist.forEach(myOption => {
				this.matchlist.forEach(theirOption => {
					if (myOption.accept === theirOption.offer || myOption.offer === theirOption.accept) {
						myMatch = myOption;
						theirMatch = theirOption;
					}
				})
			});
			if (!myMatch) {
				return undefined;
			}
			let dataChannel = new MessageChannel;
			let connectPort = this.trigger.ports[0];
			let release = () => {
				connectPort.postMessage('release');
				connectPort.close();
				dataChannel.port1.close();
			};
			connectPort.postMessage({
				connect: true,
				proposals: validMatchlist,
				protocol: myMatch!.accept || myMatch!.offer,
				role: myMatch!.accept ? 'accept' : 'offer',
				accepting: myMatch!.accept,
				offering: myMatch!.offer
			}, [dataChannel.port2]);

			return this.session = {
				port: dataChannel.port1,
				origin: this.trigger.origin,
				matchlist: this.matchlist,
				offering: myMatch!.offer,
				accepting: myMatch!.accept,
				hint: theirMatch!.hint,
				closed: new Promise(resolve => {
					addEventListener('unload', () => resolve());
				}),
				cancel: release,
				release
			};
		} catch (e) {
			console.log(e);
			if (this.session) this.session.cancel();
			throw e;
		}
	}

	/**
	 * Perform a match. Note if you are calling this directly it may be easier
	 * to use [[commit]] which is synchronous
	 * 
	 * @param matchlist 
	 */
	match(matchlist: MatchOption|MatchOption[]): Promise<Session|undefined> {
		try {
			return Promise.resolve(this.commit(matchlist));
		} catch (e) {
			return Promise.reject(e);
		}
	}

	/**
	 * Listen for a request from a client The request is saved in [[ServiceRequest.received]]
	 * and passsed to the `handler` function. If an error occurs, it is passed in
	 * the second parameter and there is no `req`.
	 * 
	 * @param handler function called when receiving a request
	 */
	static receive(handler: (req?: ServiceRequest, err?: Error) => void): void {
		try {
			if (window.opener && window.opener.parent !== window.opener) {
				window.opener.postMessage({
					'https://poppy.io/a/to-client': {listen:true}
				}, '*');
			}
			if (typeof CustomEvent === 'function') {
				dispatchEvent(new CustomEvent('https://poppy.io/a/listening'));
			}
			let gotRequest = false;
			addEventListener('message', (ev: MessageEvent) => {
				let req: ServiceRequest|undefined = undefined;
				try {
					if (gotRequest) return;
					if (!ev.data) return;
					let toHost: any = ev.data['https://poppy.io/a/to-host'];
					if (!toHost) return;
					if (toHost.expired) throw Error('Poppy.io: already-connected');
					if (!toHost.request) return;
					this.received = new ServiceRequest(ev, validateMatchlist(toHost.request), toHost.launch);
					gotRequest = true;
				} catch (e) {
					handler(undefined, e);
					return;
				}
				handler(this.received);
			});
		} catch (e) {
			handler(undefined, e);
		}
	}
}
