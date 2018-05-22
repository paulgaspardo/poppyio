export { DialogOpener as default }

import { Dialog } from './dialog';
import { MatchOption, Matcher, Session, validateMatchlist } from "./common";

const URL_PATTERN = /^[A-Za-z\+\.\-]+\:\/\/[^/]+/;

/**
 * A set of localized strings.
 */
export interface Strings {

	/** The language tag (e.g. "en-US" for US English) */
	lang: string;

	/** The name of the language, in the language itself (e.g. "日本語" for Japanese) */
	langName: string;

	/** The strings */
	[key:string]:string;
}

/**
 * [[DialogOpener]] properties.
 */
export interface DialogOpenerProperties {

	/**
	 * The lauch page which presents a user interface to pick a poppy if there
	 * is no [[DialogOpenerProperties.poppyUrl]] set. Also responsible for resolving
	 * the `poppyUrl` and directing the user there if [[DialogOpenerProperties.poppyDomain]]
	 * is set. Can be either a string with the URL of the launch page, or a function
	 * which gets called with the [[Dialog]] being launched, from which you
	 * can access [[Dialog.popup]] for the window and [[Dialog.opener]]
	 * for the `DialogOpener`.
	 */
	launcher?: string|((dialog: Dialog, matchlist:MatchOption[]) => void);

	/**
	 * The page to use for the IE Hack.
	 * 
	 * Internet Explorer 10 (and earlier versions of Internet Explorer 11) have
	 * a bug that prevents cross-origin cross-document messages from being
	 * delivered between a popup window and its opener, which is something
	 * necessary for Poppy I/O to function.
	 * 
	 * The hack to make it work is to (1) open a URL on the same domain as the
	 * client, (2) go to about:blank, and then (3) from then on it works.
	 * Identified by Bruno Laurinec. https://stackoverflow.com/a/36630058
	 */
	iePrelude?: string|null;

	/**
	 * The name of the client, i.e. the name of the website requesting an
	 * activity over Poppy I/O. Used by the [[starter]] launcher for the title
	 */
	clientName?: string|null;

	/**
	 * Description of the activity being performed, e.g. "Pick a Photo". Displayed
	 * to the user by the [[starter]] launcher
	 */
	activityName?: string|null;

	/**
	 * Localized strings to used for user-facing text. Used by [[starter]]
	 * launcher.
	 */
	strings?: Strings[];

	/**
	 * Authorized origins set.
	 */
	origins?: string[]|null;

	/**
	 * The preferred language to display the launcher UI in
	 */
	lang?: string|null;

	/**
	 * URL of the poppy to open. If set the launcher is skipped
	 */
	url?: string|null;

	/**
	 * Domain of a poppy to resolve using the Domain Resolution Procedure
	 */
	domain?: string|null;

	/**
	 * Whether to perform a namecheck. 
	 */
	namecheck?: boolean|null;

	/**
	 * Set to true to disable <script> injection. Inline scripts are injected
	 * as a workaround to allow poppyio to work inside sandboxed iframes.
	 * We open the dialog window with a sandbox window as its opener, and since
	 * we are in a sandbox and are not the opener we are not able to manage
	 * that window. To work around this we inject a <script> tag that declares
	 * a function we call to close or navigate the window, but if you have
	 * a Content-Security-Policy in place that prevents inline scripts error
	 * get logged to the console. Setting this to false will disable that.
	 */
	noInject?: boolean|null;
}

/**
 * Starting point for opening a poppy
 * 
 * A `DialogOpener` opens a dialog window. It's a reusable object that you
 * can use to create as many [[Dialog]] windows as you want. You can use a
 * `DialogOpener` as a template to make other `DialogOpener`s via the
 * [[DialogOpener.with]] method, which creates a new `DialogOpener` with
 * the object you called the method on as its `prototype`.
 * 
 * The easiest way to use `DialogOpener` is to use [[Opener]] instead, which
 * adds the SOAP functions as methods on the object.
 */
export class DialogOpener implements DialogOpenerProperties, Matcher {

	iePrelude?: string|null;
	clientName?: string|null;
	activityName?: string|null;
	strings: Strings[];
	launcher?: string|((session: Dialog, matchlist:MatchOption[]) => void);
	origins?: string[]|null;
	lang?: string|null;
	url?: string|null;
	domain?: string|null;
	namecheck?: boolean|null
	noInject?: boolean|null;

	/**
	 * Constructor
	 * @param properties proeprties to initialize this object with
	 */
	constructor(properties?: DialogOpenerProperties) {
		this.strings = [];
		this.namecheck = false;
		this.origins = [];
		this.assign(properties||{});
	}

	/**
	 * Open an empty dialog window.
	 */
	open(): Dialog {
		return this.bind(new Dialog).open(this);
	}

	/**
	 * Perform a match operation. 
	 * 
	 * @param match  Matchlist to match against services
	 * @param client If specified, a dialog that is bound to this opener.
	 */
	match(matchlist: MatchOption|MatchOption[], dialog?: Dialog): Promise<Session|undefined> {
		try {
			let validatedMatchlist = validateMatchlist(matchlist);
			dialog = (dialog && dialog.open()) || this.open();
			if (dialog.popup) {
				if (this.url) {
					dialog.origins.push(getOrigin(this.url));
					dialog.popup.location.replace(this.url);
				} else if (typeof this.launcher === 'function') {
					this.launcher(dialog, validatedMatchlist);
				} else if (typeof this.launcher === 'string') {
					dialog.popup.location.replace(this.launcher);
				}
			}
			if (dialog.state !== 'opened') throw Error('Poppy.io: not-connectable, ' + dialog.state);
			dialog.state = 'matching';
			let connectPromise = new Promise<Session|undefined>((resolve, reject) => {
				dialog!.proxy!.contentWindow!.addEventListener('message', (ev: MessageEvent) => {
					try {
						// Origin check
						let trusted = ev.origin === location.protocol + '//' + location.host
							|| ev.origin === dialog!.proxy!.getAttribute('data-piox-origin');
						if (!trusted && dialog!.origins.indexOf(ev.origin) === -1) {
							return;
						}

						// Get body
						if (!ev.data) return;
						let body: any = ev.data['https://poppy.io/a/to-client'];
						if (!body) {
							return;
						}
						// Set Origins
						if (body.origins) {
							if (Array.isArray(body.origins)) {
								dialog!.origins = body.origins.filter((s: any) => typeof s === 'string');
							}
						}
						// Cancel
						if (body.close) {
							dialog!.cancel();
							resolve(undefined);
							return;
						}
						// Listen
						if (body.listen) {
							if (dialog!.state !== 'matching') {
								ev.source!.postMessage({
									'https://poppy.io/a/to-host': {
										expired: true
									}
								}, ev.origin);
							}
							onListen(dialog!, validatedMatchlist, ev, trusted, resolve, reject);
							return;
						}
					} catch (e) {
						dialog!.cancel();
						reject(e);
					}
				});
			});
			return Promise.race([connectPromise, dialog.closed]);
		} catch (e) {
			if (dialog) dialog.cancel();
			return Promise.reject(e);
		}
	}

	/**
	 * Creates a new `DialogOpener` with this `DialogOpener` as its prototype.
	 * This allows you to use one `DialogOpener` as a template for others. All
	 * the enumerable own-properties in `properties` will be assigned in the
	 * newly created opener; anything not assigned will be inherited from this
	 * object (or its prototypes).
	 * 
	 * Note that any changes you make to this object will be reflected in all 
	 * descended objects created through `with()` that have not overriden the property.
	 * 
	 * @param properties Properties to assign in the child. Any properties not
	 *                   assigned will be inherited from the parent (this object).
	 *     
	 */
	with(properties: DialogOpenerProperties): DialogOpener {
		return Object.create(this).assign(properties) as DialogOpener;
	}

	/**
	 * Assign properties on this object in bulk. All enumerable, own-properties
	 * in the `properties` object will be assigned.
	 * 
	 * @param properties Properties to assign
	 */
	assign(properties: DialogOpenerProperties): this {
		Object.keys(properties).forEach(prop => (<any>this)[prop] = (<any>properties)[prop]);
		return this;
	}

	/**
	 * Binds a [[Dialog]] that was created without any `DialogOpener` to this one.
	 * 
	 * This sets the [[Dialog.opener]] to this `DialogOpener`.
	 * 
	 * @param what A [[Dialog]] that was created indepedent of a `DialogOpener`
	 */
	bind(what: Dialog): Dialog {
		what.opener = this;
		what.origins = this.origins || [];
		return what;
	}

	/**
	 * Retrieves a localized string from [[DialogOpener.strings]], using
	 * [[DialogOpener.lang]] for the language. Currently it only does a
	 * simple comparison of locale tags - en-US and en are treated as entirely
	 * different.
	 * 
	 * @param key key of the string to retrieve
	 */
	getString(key: string): string|undefined {
		return (this.strings||[]).reduce((prev, curr) => {
			if (!curr[key]) return prev;
			if (curr.lang !== this.lang) return prev;
			return curr;
		})[key];
	}
}

/**
 * Handle a `listen` message from a service
 * 
 * @param dialog The open dialog
 * @param myMatchlist The matchlist we are sending
 * @param trigger The event the `listen` came with
 * @param trusted True if the origin is trusted and should get launch information
 * @param resolve Function to resolve the match promise with
 * @param reject Function to reject the match promise with
 */
function onListen(
		dialog: Dialog,
		myMatchlist: MatchOption[],
		trigger: MessageEvent,
		trusted: boolean,
		resolve: ((session:Session)=>void),
		reject: (reason: any) => void) {
	// Service connects by sending us a message over the control channel
	let controlChannel = new MessageChannel;
	let session: Session|undefined = undefined;
	let requestMessage: any = {
		request: myMatchlist,
		lang: dialog.opener!.lang
	};
	// Trusted origins (browser extensions and same origin) get extra information
	// suitable for implementing a launcher
	if (trusted) {
		requestMessage.launch = {
			clientName: dialog.opener!.clientName,
			activityName: dialog.opener!.activityName,
			service: dialog.opener!.url
		}
	}
	// Inform service of request and wait for connect()
	trigger.source!.postMessage({ 'https://poppy.io/a/to-host': requestMessage }, trigger.origin, [controlChannel.port1]);
	let controlPort = controlChannel.port2;
	controlPort.onmessage = ev => {
		// Await connect message
		try {
			if (!ev.data) return;
			if (ev.data.close && session) session.cancel();
			if (!ev.data.connect) return;
			
			if (dialog!.state !== 'matching') {
				throw Error('Poppy.io: not connectable');
			}
			let theirMatchlist = validateMatchlist(ev.data.proposals);
			// Verify role is valid
			let peerRole = ev.data.role as 'accept'|'offer';
			if (peerRole !== 'accept' && peerRole !== 'offer') {
				throw Error('Poppy.io: unrecognized role');
			}
			let myRole = peerRole === 'accept' ? 'offer' : 'accept';
			let protocol = ev.data.protocol;
			if (typeof ev.data.protocol !== 'string') {
				throw Error('Poppy.io: match is not a string');
			}
			// Verify protocol/role matches something we asked for
			if (!myMatchlist.some((req: any) => req[myRole] === protocol)) {
				throw Error('Poppy.io: no local match');
			}
			// Verify protocol/role is present in proposals list
			let theirMatch: MatchOption|undefined = undefined;
			let found = false;
			for (let i = 0; i < theirMatchlist.length; i++) {
				if (theirMatchlist[i][peerRole] === protocol) {
					theirMatch = theirMatchlist[i];
				}
			}
			if (!theirMatch) {
				throw Error('Poppy.io: no peer match');
			}
			// Verify control port is present
			if (ev.ports.length < 1) {
				throw Error('Poppy.io: no ports');
			}
			session = dialog.session = {
				port: ev.ports[0],
				origin: trigger.origin,

				matchlist: theirMatchlist,
				accepting: theirMatch.offer,
				offering: theirMatch.accept,
				hint: theirMatch.hint,

				closed: dialog.closed,
				cancel: dialog.cancel.bind(dialog),
				release() {
					controlPort.postMessage('release');
					controlPort.close();
					ev.ports[0].close();
				}
			};
			dialog.state = 'connected';
			resolve(session);
		} catch (e) {
			dialog.cancel();
			reject(e);
		}
	};
}

export function getOrigin(url: string, relativeTo?: string) : string {
	let match = url.match(URL_PATTERN);
	if (!match) {
		if (relativeTo) return getOrigin(relativeTo);
		return '';
	} else {
		return match[0];
	}
}
