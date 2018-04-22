import { DialogOpener, DialogOpenerProperties } from "./core/dialog-opener";
import { Dialog } from "./core/dialog";
import { acceptObject, AcceptObjectArgs, beginAcceptObject, BeginAcceptObjectArgs, AcceptedObject, Reply } from "./soap/accept";
import { offerObject, OfferObjectArgs, beginOfferObject, BeginOfferObjectArgs, AcceptedObjectOffer, ObjectOffer, OfferData } from "./soap/offer";
import { Kinds } from "./soap/common";
import { soapify, SoapMixin } from "./soap/mixin";

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
export class Poppy extends DialogOpener implements SoapMixin {

	/**
	 * A global base opener. Use [[Opener.any]] to automatically initialize it.
	 */
	static base?: Poppy;

	/**
	 * Constructor
	 * 
	 * @param properties dialog opener properties
	 */
	constructor(properties?: DialogOpenerProperties) {
		super(properties);
		soapify(this);
	}

	/**
	 * Equivalent to `Opener.any().with(...)`, saves a little typing.
	 * 
	 * @param properties properties to override in new `Opener`
	 */
	static with(properties: DialogOpenerProperties): Poppy {
		return this.any().with(properties) as Poppy;
	}

	/**
	 * Get the [[Opener.base]] launcher and create it if it wasn't already.
	 */
	static any(): Poppy {
		return this.base || (this.base = new Poppy());
	}

	/**
	 * Binds [[Dialog]] to this [[Opener]] and adds [[SoapMixin]] to it
	 * 
	 * @param dialog 
	 */
	bind(dialog: Dialog): Dialog & SoapMixin {
		return soapify(super.bind(dialog));
	}

	/**
	 * Open this [[Dialog]] with an empty scri
	 */
	open(): Dialog & SoapMixin {
		return this.bind(super.open());
	}

	accept: (kinds: Kinds, reply?: Reply) => Promise<AcceptedObject|undefined>;
	static accept(kinds: Kinds, reply?: Reply): Promise<AcceptedObject|undefined> {
		return this.any().accept(kinds, reply);
	}

	beginAccept: (kinds: Kinds) => Promise<AcceptedObject|undefined>;
	static beginAccept(kinds: Kinds): Promise<AcceptedObject|undefined> {
		return this.any().beginAccept(kinds);
	}
	
	offer: (kinds: Kinds, data: OfferData) => Promise<AcceptedObjectOffer|undefined>;
	static offer(kinds: Kinds, data: OfferData): Promise<AcceptedObjectOffer|undefined> {
		return this.offer(kinds, data);	
	}
	
	/**
	 * Invoke [[beginOfferObject]] with this [[Opener]] as the `to`
	 * @param args 
	 */
	
	beginOffer(kinds: Kinds): Promise<ObjectOffer|undefined> {
		return beginOfferObject(this, kinds);
	}

	static beginOffer(kinds: Kinds): Promise<ObjectOffer|undefined> {
		return this.beginOffer(kinds);
	}

}
