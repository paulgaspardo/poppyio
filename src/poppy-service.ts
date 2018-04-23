import { ServiceRequest } from "./core/service-request";
import { SoapMixin, soapify } from "./soap/mixin";

export class PoppyService {
	static client?: ServiceRequest & SoapMixin;
	static onClient(callback: (client?: ServiceRequest & SoapMixin, err?: Error) => void) {
		ServiceRequest.receive((req?: ServiceRequest, err?: Error) => {
			let client: ServiceRequest&SoapMixin|undefined = this.client = req && soapify(req);
			callback(client, err);
		});
	}
	static close() {
		window.close();
	}
}
