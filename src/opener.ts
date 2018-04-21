import { DialogOpener, DialogOpenerProperties } from "./core/dialog-opener";
import { Dialog } from "./core/dialog";
import { acceptObject, AcceptObjectArgs, beginAcceptObject, BeginAcceptObjectArgs, AcceptedObject } from "./soap/accept";
import { offerObject, OfferObjectArgs, beginOfferObject, BeginOfferObjectArgs, AcceptedObjectOffer, ObjectOffer } from "./soap/offer";

/**
 * `DialogOpener` + `SoapMixin`
 * 
 * This [[DialogOpener]] subclass implements [[SoapMixin]] and adds it to the
 * [[Dialog]]s it creates to make it more convenient to use.
 * 
 * It also maintains a global base `Opener` ([[Opener.base]]) which the `"use-*"`
 * modules configure to use the default [[starter]] launcher and install their
 * localized strings into.	
 */
export class Opener extends DialogOpener implements SoapMixin {

	/**
	 * A global base opener. Use [[Opener.any]] to automatically initialize it.
	 */
	static base?: Opener;

	/**
	 * Constructor
	 * 
	 * @param properties dialog opener properties
	 */
	constructor(properties?: DialogOpenerProperties) {
		super(properties);
	}

	/**
	 * Equivalent to `Opener.any().with(...)`, saves a little typing.
	 * 
	 * @param properties properties to override in new `Opener`
	 */
	static with(properties: DialogOpenerProperties): Opener {
		return this.any().with(properties) as Opener;
	}

	/**
	 * Get the [[Opener.base]] launcher and create it if it wasn't already.
	 */
	static any(): DialogOpener {
		return this.base || (this.base = new Opener());
	}

	/**
	 * Binds [[Dialog]] to this [[Opener]] and adds [[SoapMixin]] to it
	 * 
	 * @param dialog 
	 */
	bind(dialog: Dialog): Dialog & SoapMixin {
		super.bind(dialog);
		(<SoapMixin><any>dialog).acceptObject = this.acceptObject;
		(<SoapMixin><any>dialog).beginAcceptObject = this.beginAcceptObject;
		(<SoapMixin><any>dialog).offerObject = this.offerObject;
		(<SoapMixin><any>dialog).beginOfferObject = this.beginOfferObject;
		return dialog as Dialog & SoapMixin;
	}

	/**
	 * Open this [[Dialog]] with an empty scri
	 */
	open(): Dialog & SoapMixin {
		return this.bind(super.open());
	}

	/**
	 * Invoke [[acceptObject]] with this [[Opener]] as the `from`
	 * @param args 
	 */
	acceptObject(args: AcceptObjectArgs): Promise<AcceptedObject|undefined> {
		return acceptObject(this, args);
	}

	/**
	 * Invoke [[beginAcceptObject]] with this [[Opener]] as the `from`
	 * @param args 
	 */
	beginAcceptObject(args: BeginAcceptObjectArgs): Promise<AcceptedObject|undefined> {
		return beginAcceptObject(this, args);
	}
	
	/**
	 * Invoke [[offerObject]] with this [[Opener]] as the `to`
	 * @param args 
	 */
	offerObject(args: OfferObjectArgs): Promise<AcceptedObjectOffer|undefined> {
		return offerObject(this, args);
	}
	
	/**
	 * Invoke [[beginOfferObject]] with this [[Opener]] as the `to`
	 * @param args 
	 */
	beginOfferObject(args: BeginOfferObjectArgs): Promise<ObjectOffer|undefined> {
		return beginOfferObject(this, args);
	}

}

/**
 * Methods making it more convenient to use SOAP
 */
export interface SoapMixin {

	/**
	 * Invoke [[acceptObject]] with this object as the `from`
	 * @param args 
	 */
	acceptObject(args: AcceptObjectArgs): Promise<AcceptedObject|undefined>;

	/**
	 * Invoke [[beginAcceptObject]] with this object as the `from`
	 * @param args 
	 */
	beginAcceptObject(args: BeginAcceptObjectArgs): Promise<AcceptedObject|undefined>;

	/**
	 * Invoke [[offerObject]] with this object as the `to`
	 * @param args 
	 */
	offerObject(args: OfferObjectArgs): Promise<AcceptedObjectOffer|undefined>;

	/**
	 * Invoke [[beginOfferObject]] with this [[Opener]] as the `to`
	 * @param args 
	 */
	beginOfferObject(args: BeginOfferObjectArgs): Promise<ObjectOffer|undefined>;
}
