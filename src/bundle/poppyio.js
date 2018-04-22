// Bundle set up for using the starter launcher.

export * from "../../target/index.mjs";
import { Poppy } from "../../target/poppy.mjs";
import { starter } from "../../target/launch/starter.mjs";

// set up base PoppyOpener
Poppy.any().launcher = starter;
