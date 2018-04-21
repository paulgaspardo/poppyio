export * from "./index";
export { strings, $LangSym$ } from "./strings-$LangTag$";
export { Opener as default }

import { Opener } from "./opener";
import { strings } from "./strings-$LangTag$";
import { starter } from "./launch/starter";

let base = Opener.any();
base.strings.push(strings);
base.launcher = starter;
