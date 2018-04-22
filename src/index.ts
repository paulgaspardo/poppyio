import { DialogOpener, DialogOpenerProperties } from './core/dialog-opener';
import { Poppy } from './poppy';

// Export core
export { Matcher, MatchOption, Session, validateMatchlist } from './core/common';
export { Dialog } from './core/dialog';
export { DialogOpener, DialogOpenerProperties } from './core/dialog-opener';
export { ServiceRequest } from './core/service-request';

// Export SOAP
export { acceptObject, beginAcceptObject, AcceptObjectArgs, AcceptedObject, BeginAcceptObjectArgs } from './soap/accept';
export { offerObject, beginOfferObject, OfferObjectArgs, BeginOfferObjectArgs, ObjectOffer, AcceptedObjectOffer } from './soap/offer';

// Export user-friendly opener
export { Poppy, Poppy as default } from "./poppy";

export { PoppyService } from "./poppy-service";

/**
 * Version of poppyio.js
 */
export const version: string = '$Version$';
