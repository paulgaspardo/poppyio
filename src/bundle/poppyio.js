// Bundle set up for using the starter launcher.

export * from "../../target/index.mjs";
import { Opener } from "../../target/opener.mjs";
import { starter } from "../../target/launch/starter.mjs";

// set up base PoppyOpener
Opener.any().launcher = starter;
