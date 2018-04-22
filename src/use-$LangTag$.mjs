export * from "./index.mjs";
export { strings, $LangSym$ } from "./strings-$LangTag$.mjs";
export { Poppy as default }

import { Poppy } from "./poppy.mjs";
import { strings } from "./strings-$LangTag$.mjs";
import { starter } from "./launch/starter.mjs";

let base = Poppy.any();
base.strings.push(strings);
base.launcher = starter;
