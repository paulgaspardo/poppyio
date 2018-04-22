export * from "./index.mjs";
export { strings, $LangSym$ } from "./strings-$LangTag$.mjs";
export { Opener as default }

import { Opener } from "./opener.mjs";
import { strings } from "./strings-$LangTag$.mjs";
import { starter } from "./launch/starter.mjs";

let base = Opener.any();
base.strings.push(strings);
base.launcher = starter;
