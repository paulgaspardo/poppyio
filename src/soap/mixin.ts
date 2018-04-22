import { Kinds } from "./common";
import acceptObject, { Reply, AcceptedObject, beginAcceptObject } from "./accept"
import offerObject, { OfferData, ObjectOffer, AcceptedObjectOffer, beginOfferObject } from "./offer";

/**
 * Methods making it more convenient to use SOAP
 */
export interface SoapMixin {

	/**
	 * Invoke [[acceptObject]] with this object as the `from`
	 * @param args 
	 */
	accept(kinds: Kinds, reply?: Reply): Promise<AcceptedObject|undefined>;

	/**
	 * Invoke [[beginAcceptObject]] with this object as the `from`
	 * @param args 
	 */
	beginAccept(kinds: Kinds): Promise<AcceptedObject|undefined>;

	/**
	 * Invoke [[offerObject]] with this object as the `to`
	 * @param args 
	 */
	offer(kinds: Kinds, data: OfferData): Promise<AcceptedObjectOffer|undefined>;

	/**
	 * Invoke [[beginOfferObject]] with this [[Opener]] as the `to`
	 * @param args 
	 */
	beginOffer(kinds: Kinds): Promise<ObjectOffer|undefined>;
}

export function soapify<T>(unsoapy: T): T & SoapMixin {
	(<SoapMixin><any>unsoapy).accept = function (kinds: Kinds, reply?: Reply) {
		return acceptObject(this, kinds, reply);
	};
	(<SoapMixin><any>unsoapy).beginAccept = function (kinds: Kinds) {
		return beginAcceptObject(this, kinds);
	};
	(<SoapMixin><any>unsoapy).offer = function (kinds: Kinds, data: OfferData) {
		return offerObject(this, kinds, data);
	};
	(<SoapMixin><any>unsoapy).beginOffer = function (kinds: Kinds) {
		return beginOfferObject(this, kinds);
	};
	return unsoapy as T & SoapMixin;
}
