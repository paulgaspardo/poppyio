import { resolveName } from './resolve';
import { Dialog } from '../core/dialog';
import { DialogOpener, DialogOpenerProperties, Strings, getOrigin } from '../core/dialog-opener';
import { MatchOption } from '../core/common';
import { match } from 'minimatch';
import { version } from '../index';
interface State {
	openModal?: any;
	focused?: HTMLElement|null;
	errorMessage?: string|null;
	search?: string;
	clientName: string;
	OB: string;
	CB: string;
}

/** HTML inserted by build process */
declare const $DialogHtml$: string;
/**
 * 
 * @param session 
 * @param options 
 */
export function starter(dialog: Dialog, matchlist: MatchOption[]) {
	let leaving = false;
	let popup = dialog.popup!;
	let document = popup.document;
	let opener = dialog.opener!;
	let $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T|null;
	let $$ = <T extends HTMLElement>(sel: string) => Array.prototype.slice.call(document.querySelectorAll(sel)) as T[];
	let style = (sel: string|HTMLElement, styles: {[P in keyof CSSStyleDeclaration]?: CSSStyleDeclaration[P]}) => {
		(typeof sel === 'string' ? $$(sel) : [sel]).forEach(node => {
			for (let key in styles) {
				(node.style as any)[key] = (styles as any)[key];
			}
		})
	};
	let state: State = {
		OB:'{',
		CB:'}',
		clientName: dialog.opener!.clientName || document.domain
	};
	let setState = (updates: {[P in keyof State]?:State[P]}) => {
		if (updates.focused && updates.focused !== state.focused) {
			state.focused = updates.focused;
			updates.focused.focus();
			Promise.resolve().then(() => updates.focused!.focus());
		}
		for (let key in updates) {
			(state as any)[key] = (updates as any)[key];
		}
		style('#modal', {
			display: state.openModal ? 'flex' : 'none'
		});
		style('#main', {
			opacity: state.openModal ? '0.5' : null
		});
		if (state.openModal) {
			$('#input')!.blur();
			$$('.modal-body').forEach(modalBody => {
				modalBody.style.display = modalBody.id === state.openModal.id ? 'block' : 'none'
			});
		}
		
		let translated = (key: string) =>
			(opener.getString(key) || key + '???')
				.replace(/\{(\w+)\}/g, (_: any, s: string) => (state as any)[s]);

		$$('[data-t]').forEach(el => {
			el.textContent = translated(el.getAttribute('data-t')!);
		});
		$('#clientName')!.textContent = state.clientName;
		$('#activityTitle')!.textContent = document.title = opener.activityName || translated('connectPoppy');
	};
	document.write($DialogHtml$);
	applyBaseStyles(style);

	let matchInfo = $('#matchInfo')!;
	matchlist.forEach(matchOption => {
		let matchDetail = document.createElement('div');
		matchDetail.textContent = (matchOption.accept ? 'Accept ' : 'Offer ') + (matchOption.accept || matchOption.offer) + ' '
			+ (matchOption.hint && Array.isArray(matchOption.hint.types) ? matchOption.hint.types.join(', ') : '');
		matchInfo.appendChild(matchDetail);
	});

	setState({focused: $('#input')});

	$('#theForm')!.addEventListener('submit', e => {
		e.preventDefault();
		let input = $<HTMLInputElement>('#input')!;
		let cancelled = false;
		let returnFocusTo = state.focused && state.focused.nodeName !=='BUTTON' ? state.focused : input;
		if (state.focused) state.focused.blur();

		setState({
			search: input.value,
			openModal: {
				id: 'loading',
				cancel() {
					cancelled = true;
					setState({
						focused: returnFocusTo,
						openModal: null
					});
				}
			}
		});

		resolveName($<HTMLInputElement>('#input')!.value).then(result => {
			if (cancelled) return;
			setState({
				openModal: {
					id: 'found'
				}
			});
			leaving = true;
			dialog.origins.push(getOrigin(result.url));
			try {
				dialog.popup!.location.replace(result.url);
			} catch (e) {
				(<any>dialog.proxy!.contentWindow).pio_nav(dialog.popup, result.url);
			}
		}).catch(error => {
			if (cancelled) return;
			setState({
				errorMessage: error.message,
				focused: $('#wontWork-ok'),
				openModal: {
					id: 'wontWork',
					cancel() {
						setState({
							errorMessage: null,
							focused: returnFocusTo,
							openModal: null
						});
					}
				}
			})
		});
	});

	$('#cancel')!.addEventListener('click', e => {
		dialog.cancel();
	});
	$('#version')!.innerText = 'poppyio ' + version;

	document.body.addEventListener('click', e => {
		let modalAction = (e.target as HTMLElement).getAttribute('data-modal-action');
		if (modalAction) {
			state.openModal[modalAction!]();
		}
	});

	document.body.addEventListener('keyup', e => {
		if (e.keyCode === 27) {
			if (state.openModal) {
				if (typeof state.openModal.cancel === 'function') {
					state.openModal.cancel();
				}
			} else {
				dialog.cancel();
			}
		}
	});

	document.body.addEventListener('focusin', e => {
		state.focused = e.target as HTMLElement;
		setState({});
	});
	document.body.addEventListener('focusout', e => {
		if (e.target === state.focused) state.focused = null;
		setState({});
	});

	popup.addEventListener('unload', () => {
		if (!leaving) dialog.cancel();
	})
}

function applyBaseStyles(style: (sel:string|HTMLElement, styles:{[P in keyof CSSStyleDeclaration]?: CSSStyleDeclaration[P]}) => void) {
	style('body', {
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		margin: '0',
		backgroundColor: 'white',
		color: 'black',
		textAlign: 'center'
	});
	style('html,body', {
		height: '100%'
	});
	style('#box', {
		display: 'flex',
		margin: '0',
		flexDirection: 'column',
		height: '100%',
		padding: '1rem',
		boxSizing: 'border-box'
	});
	style('#main', {
		maxWidth: '40rem',
		margin: 'auto',
		width: '100%'
	});
	style('h1, h2', {
		fontSize: '1rem',
		margin: '0'
	});
	style('h1', {
		fontWeight: 'normal'
	})
	style('h2', {
		marginBottom: '0.2rem',
		fontSize: '1.5rem'
	});
	style('#theForm', {
		display: 'block'
	});
	style('#input', {
		width: '100%'
	});
	style('#theForm button', {
		width: '6rem',
		margin: '0.5rem'
	});
	style('#modal', {
		position: 'absolute',
		left: '0',
		top: '0',
		width: '100%',
		height: '100%',
		flexDirection: 'column'
	});
	style('#modal-box', {
		backgroundColor: 'white',
		maxWidth: '30rem',
		margin: 'auto',
		padding: '1rem 2rem',
		border: 'solid 1px #aaaaaa',
		borderRadius: '0.3rem',
		boxShadow: '0.2rem 0.2rem 0.2rem #dddddd'
	});
	style('.modal-buttons', {
		textAlign: 'center'
	});
	style('.modal-buttons button', {
		width: '10rem'
	});
	style('#matchInfo, #version', {
		fontSize: '0.7rem'
	});
}
