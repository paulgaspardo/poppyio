**Note:** The files you see here aren't the `poppyio` package, they're the files
used to build the `poppyio` package. To do that run `npm build`; the generated
package will be in the `target/` directory.

----------------------------------------
# Poppy I/O

*Note: This README, and Poppy I/O in general, is an early work in progress. It's
definitely incomplete and the parts that aren't are probably wrong :) *

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [What is it?](#what-is-it)
- [The Elements of Poppy I/O](#the-elements-of-poppy-io)
  - [Try it out](#try-it-out)
  - [Naming](#naming)
- [System Requirements](#system-requirements)
  - [For Browsers](#for-browsers)
  - [For Servers](#for-servers)
- [The JavaScript API: `poppyio`](#the-javascript-api-poppyio)
  - [Setup](#setup)
    - [Browser Bundles](#browser-bundles)
    - [ES Modules](#es-modules)
    - [CommonJS Modules](#commonjs-modules)
    - [AMD Modules](#amd-modules)
  - [Launching a Poppy (Client)](#launching-a-poppy-client)
    - [Configuration](#configuration)
      - [For Module Users](#for-module-users)
      - [For Bundle Users](#for-bundle-users)
    - [Picking an Image](#picking-an-image)
    - [`DialogOpener` objects](#dialogopener-objects)
      - [`DialogOpener` properties](#dialogopener-properties)
    - [Using the `Opener` class](#using-the-opener-class)
      - [Get the base `DialogOpener` with `Opener.any()`](#get-the-base-dialogopener-with-openerany)
      - [Get the base `DialogOpener` and modify it with `Opener.with()`](#get-the-base-dialogopener-and-modify-it-with-openerwith)
- [Protocol](#protocol)
    - [Launch: Open a popup window](#launch-open-a-popup-window)
    - [Name Resolution: Navigate to the poppy URL](#name-resolution-navigate-to-the-poppy-url)
    - [Matching: Establishing a Connection](#matching-establishing-a-connection)
      - [Service: Signal it is `listen`ing](#service-signal-it-is-listening)
      - [Client: Indicate its `request`](#client-indicate-its-request)
      - [Service: Connect](#service-connect)
      - [Client/Service: The Session](#clientservice-the-session)
      - [Non-SOAP exchanges](#non-soap-exchanges)
      - [Service: Close the Session](#service-close-the-session)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# What is it?

Poppy I/O is a concept for a JavaScript API and set of protocols for cloud file
pickers and other similar things - *poppies* in Poppy I/O parlance.

A **poppy** is a web page that provides a service to other, client web pages,
and is activated by the client web page opening the poppy in a popup dialog
window. By this definition [Dropbox Choosers](https://www.dropbox.com/developers/chooser)
and [Twitter Web Intents](https://dev.twitter.com/web/intents) would count as poppies
(although they don't use Poppy I/O).

The idea of Poppy I/O is to define a common API to allow client
apps to work with any number of poppies without modification, and beyond that
make it so that users themselves can pick the poppies they want to use - essentially
the same idea as [Web Intents](https://github.com/PaulKinlan/WebIntents).

Here's what `poppyio` looks like. (You don't have to use ES6.)
```html
<button id='pickButton'>Pick Photo</button>
<script type='module'>
  import { Poppy, acceptObject } from "https://js.poppy.io/0.0.1/use-en.mjs";
  pickButton.onclick = async () => {
    let pick = await acceptObject(Poppy.any(), {
      kind: "File",
      hint: {
        type: ["image/*"]
      }
    });
    if (pick) {
      let img = new Image;
      img.src = pick.File.location || URL.createObjectURL(pick.File.contents);
      document.body.appendChild(img);
    }
  }
</script>
```

# The Elements of Poppy I/O

Poppy I/O starts with a **client app**, a web page the user opened up on their own
in a browser tab.

The client app gives the user the option to perform some activity with a **poppy**.
That might be something like:

* Picking a file to use in the app
* Saving a file they created in the app
* Sharing a link

The client app may provide the option to perform the action with a specific poppy,
or let the user pick a poppy of their own. The app should always let the user pick
their own poppy in addition to any preset options.

Either way, in response to a user action (like clicking a "Pick with Poppy" button),
the client app opens a **dialog**, the popup window that will host the poppy.
The dialog may be opened by the client app directly or intercepted by a
**browser extension**, if one is installed.

If the dialog was opened with no poppy in mind, a **launcher** view opens up in the dialog
to let the user pick the poppy they wish to use. The launcher is provided by
the browser extension if it opened the dialog, otherwise the client has to
display it. In addition to possibly offering a menu of suggested, bookmarked, or recent
poppies, the launch page should also provide a way to pick a poppy by typing in
its **domain name** directly.

Entering in a poppy by domain name uses a **domain resolution** procedure to detect if a
poppy is present on that domain and determine its URL. This can be dangerous if
the user enters a domain name incorrectly - for example if they intend to upload
a file to `dropbox.com` but accidentally type `dropbox.cm` and send the file
there instead - so a safety check should be performed on any entered domain, and
any failing check shouldn't let the user proceed without a scary warning. `poppyio`
includes a feature called **Namecheck** where services can provide digital
certificates verifying a domain as not misleading.

Once the poppy is opened in the dialog, it can connect to the client to transfer
data.

The basic action in Poppy I/O is sending a single object from one **peer**
(client or service) to another, and optionally receiving a response. One side **offers** an object,
and the other **accepts** it. 

* If a client is picking a file, it is accepting a file the poppy is offering.
* If a client is sending a file, it is offering a file for the poppy to accept.
* If a client is sharing a link, it is offering a link for the poppy to accept.

Beyond simple objects, `MessagePort`s may be sent with an offer to allow for
more complex exchanges. There's also the option of bypassing the **simple offer/accept protocol**
("[S](http://harmful.cat-v.org/software/xml/soap/simple)OAP") entirely and run
a different protocol over the `MessageChannel` it uses.

The client indicates to the service what it can accept and/or offer in a **matchset**,
which the service can use to figure out if it's able to **match** one of the
client's **offers**. If it's able to accept something the client is offering, or
offer the client is accepting, a connection can be made. The accept/offer pairing
also allows for the possibility of clients connecting directly to each other,
as long as one side is accepting what another is offering.

After a match is made and the poppy is ready to exchange data with the client,
it **commits** to a match and sends a response back to the client indicating
what its accepting or offering, and the offer side sends its object to the
accept side and receives the response.

After the user finishes interacting with the poppy and whatever action
was requested is performed, the poppy dialog closes and the session is complete.
It's up to the poppy to decide when to close since it's the poppy is what has the
user's attention.

## Try it out

* [primitive.5apps.com](https://primitive.5apps.com) - a modified version of
	[primitive.js](https://ondras.github.io/primitive.js/) (which in turn is a
	JavaScript port of the original [Primitive](https://github.com/fogleman/primitive) in Go)
	using Poppy I/O to pick and save photos.

## Naming

This has changed before and might change again, but for now:

* **Poppy.io** is the name of the project and its website domain name.
* **Poppy I/O** is the set of protocols and general concept.
* **`poppyio`** is the JavaScript library implementing Poppy I/O.
* A **poppy** is a Poppy I/O service web page.

Poppy I/O isn't related to the [Poppy robotics project](https://www.poppy-project.org).

# System Requirements

## For Browsers

Any browser that supports channel messaging should work; that means Internet
Explorer 10+ and all recent versions of Chrome, Safari, Firefox, and Edge.

Internet Explorer requires a `Promise` polyfill to be installed. If you use
the single-file `<script>` bundle one is provided but if you use one of the
module formats you'll have to supply it. Also, Internet Explorer 10 and older
versions of Internet Explorer 11 require a small hack to work, which is disabled
by default.

(Also there are currently significant UI display issues in the lauch UI on Internet Explorer,
but communication works fine)

A browser extension isn't required for Poppy I/O to work (and indeed at this
point exists only as a proof of concept), but the browser extension hooks are
designed with Chrome and the [WebExtensions](https://wiki.mozilla.org/WebExtensions)
API in mind.

## For Servers

Client apps don't need anything on the server in general, but if you allow users
to pick poppies by domain and are using the starter launcher then it needs to
be able to make cross-origin requests to other servers - if you have a CSP in
place that prevents then that it won't work.

For a poppy service, in order to allow for users to locate your poppy by domain name
you need to have a `/.well-known/host-meta.json` file on your server that is
configured to allow anonymous cross-origin access. That file is used to look up
the location of the poppy for the domain.

As a rule, any data exchanged by URLs over Poppy I/O should allow anonymous
cross-origin access unless the receiving peer indicates CORS isn't required.

# The JavaScript API: `poppyio`

## Setup

`poppyio` is available in 4 different formats. 

* Browser script bundles, for inclusion via a `<script>` tag.
* ES2015 modules, for ES module bundlers like Rollup and Webpack.
* CommonJS modules, for CommonJS bundlers like Browserify and Webpack 1.
* AMD modules, for AMD loaders like require.js.

Because `poppyio` includes a default launch page user interface (which you
don't have to use), the single-file script bundles and some modules are include
localized strings. You only have to include strings for the locales you need.

### Browser Bundles

The script bundles are located in the `bundle` directory of the package. Everything
gets exported into the `poppyio` global namespace object.

* `bundle/poppyio.[lang].js` contains everything you need in a single file, in non-mified form
	* `bundle/poppyio.[lang].min.js` is the minified version
* `bundle/poppyio.add.[lang].js` adds an additional language to the single-file bundle.
	* There is no minified version


### ES Modules

The ES modules are in the `.mjs` files. They can be directly imported from browsers
that support ES modules.

### CommonJS Modules

The CommonJS modules are in `.js` files next to the `.mjs` files. They have
ES module semantics with respect to default exports - the default export is
`require("module").default`, not `require("module")` - but all default exports
are also available as a named export if that's a better fit for your aesthetic.

### AMD Modules

The AMD modules exist under the `amd/` subtree and have a parallel struture to
the ES and CommonJS Modules. So the CommonJS `core/dialog.js` has a corresponding
`amd/core/dialog.js`. Otherwise they work the same as the CommonJS modules.


## Launching a Poppy (Client)

The client opens a dialog and either loads the poppy URL into the dialog or
displays a launch page to allow the user to select the poppy they want.

### Configuration

You need to specify a launcher in order to make client requests. You can create your own launch page, but
`poppyio` includes a default implementation
called `starter` embedded in the library. `starter` launcher is available in English (`en`).
The other languages aren't ready yet.

#### For Module Users

The easiest way to use `starter` is to import
a `"use-*"` module for the appropriate language to use; it will be installed on the base
`Opener` as a sideffect. For convenince the `"use-*"` modules also export everything
from the `"index"` module, so that should be all you need to import. For example:

```
	import "poppyio/use-en";
```
You can do `"use-*"` for more than one language if your application is multilingual.

#### For Bundle Users

If you're using a `<script>` bundle, use a bundle with the appropriate language
tag in the filename. For example:
```
	<script src="/lib/poppyio/bundle/poppyio.en.min.js"></script>
```

### Picking an Image

```
pickButton.onclick = function () {
	return poppyio.acceptObject(
		new poppyio.DialogOpener({
			poppyUrl: "https://www.exampe.com/poppy.html"
		}),
		{
			kind: "File",
			hint: {
				type: ["image/*", ".jpg", ".jpeg", ".png"]
			}
		}
	).then(function (pick) {
		if (!pick) return;
		if (!pick.File) return Promise.reject(Error("Missing File"));
		var img = new Image;
		img.crossDomain = true;
		if (pick.File.location) {
			img.src = pick.File.location;
		} else if (pick.File.contents) {
			img.src = URL.createObjectURL(pick.File.contents);
			URL.revokeObjectURL(img.src);
		} else {
			return Promise.reject(Error("No URL or blob"));
		}
		return Promise.resolve(img);
	});
};
```

Explanation:

```
pickButton.onclick = function () {
```
A dialog is a popup window, so it needs to be opened in response to a user action,
like clicking a button.

```
	return poppyio.acceptObject(
```
The core operations of `acceptObject` and `offerObject` are the same for clients
and services, so are functions and not methods. However the `Opener` subclass
adds them as methods for convenience.

```
		new poppyio.DialogOpener({
			poppyUrl: "https://www.exampe.com/poppy.html"
		}),
```
The first parameter to `acceptObject` is where we are accepting the object from.I
In this case, a `DialogOpener` object. A `DialogOpener` opens a dialog popup. The
`poppyUrl` specifies that it will load a poppy directly and not a launch page.

```
		{
			kind: "File",
			hint: {
				type: ["image/*", ".jpg", ".jpeg", "gif"]
			}
		}
```
This is what we are accepting.
* Kind is the kind of object, in this case `File`.
* Hint is an object with extra details about the `File` we are accepting. What
	goes inside a hint depends on the object type.
	* The `type` indicates the file types we will accept. Both mime types and
		file extensions are allowed.

```
	).then(function (accepted) {
```
All the asynchronous operations in `poppyio` use Promises.

```
		if (!accepted) return;
```
The client doesn't treat it as an error if we didn't get a response. That means
we never matched with a service.

* The user could have closed the window without picking a service
* The user may have picked an incompatible service, but the service is responsible
	for displaying an error in that case.

We can't tell what the reason is.

```
		if (!accepted.File) return Promise.reject(Error("Missing File"));
```
If we did get a response, but it doesn't have the data we need, then it's an error.


```
		var img = new Image;
		img.crossDomain = true;
```
As a rule, any URLs used for file transfer must support CORS unless you indicate
otherwise.

```
		if (pick.File.location) {
			img.src = pick.File.location;
```
One way to send a file is by URL, in the `location` property.

```
		} else if (pick.File.contents) {
			img.src = URL.createObjectURL(pick.File.contents);
			URL.revokeObjectURL(img.src);
		}
```
Files may also be sent by blob, in the `contents` property.

```
		} else {
			return Promise.reject(Error("No URL or blob"));
		}
```
Poppy I/O doesn't do validation of the objects sent between peers.

```
		return Promise.resolve(img);
	});
};
```
Finally return the image.

### `DialogOpener` objects

* Import `{ DialogOpener }` from `poppyio`, `poppyio/core/dialog-opener`, or `poppyio/use-[lang]`  
* Import `DialogOpener` from `poppyio/core/dialog-opener`
* In script bundle, `poppyio.DialogOpener`

To open up a dialog window, you use a `DialogOpener`. It keeps track of all
the properties of a dialog window to open, most important what to open up in
the dialog window: the launcher to choose a poppy with, or the poppy URL if one is preselected.

The easiest way to create a dialog is to use the `Opener` subclass, discussed below.

Once you have a `DialogWindow`, you invoke an operation like `acceptObject()` or `offerObject()`
on it to perform an exchange. The details of the exchange are the same between
clients and services, so they are discussed in a later section.

This example accepts a file from the poppy at `https://www.example.com/poppy.html`:
```
import { DialogOpener, acceptObject } from "poppyio";

var opener = new DialogOpener({ url: "https://www.example.com/poppy.html" });
acceptObject(opener, { kind: "File" }).then(function (pick) {
	if (pick && pick.File) console.log(pick.File.location || pick.File.contents && "Blob");
});
```
The constructor accepts an object

#### `DialogOpener` properties

* `launcher` - the launcher to use to display a user interface if the user is
	picking a poppy. Can be the URL of a web page or a function.
	* `opener.launcher = "/poppyio/launcher.html"`
* `poppyUrl` - the URL of the poppy to launch. If set, other options are mostly
	irrelevant.
	* `opener.poppyUrl = "https://www.example.com/poppy"`
* `

### Using the `Opener` class

> Import `Opener` or `{ Opener }` from `poppyio`, `poppyio/opener`, or `poppyio/use-[lang]`; `poppyio.Opener` in bundle.

You can create a `DialogOpener` yourself, but it's easier to start with the
base `DialogOpener` in the `Opener` object - especially if you're using the
`"use-*"` modules, which preconfigure it to use the `starter` launcher.

```
import Opener from "poppyio/use-en";
```
That example preconfigures the `Opener.base` launcher to use English as its user
interface language.

The `Opener` class extends `DialogOpener` and adds the methods `acceptObject()`, `beginAcceptObject()`,
`offerObject()`, and `beginOfferObject()` so you don't have to import those
functions separately.

Compare, using `DialogOpener`:
```
import { DialogOpener, acceptObject } from "poppyio"

acceptObject(new DialogOpener({ poppyUrl: "https://www.example.com/poppy.html" })), {
	kind: "File"
});
```

Using `Opener`:

```
import Opener from "poppyio"

Opener.with({ poppyUrl: "https://www.example.com/poppy.html" }).acceptObject({
	kind: "File"
});
```


#### Get the base `DialogOpener` with `Opener.any()`

This opens a dialog with the default launcher and no other options. The user
picks the poppy.

```
	import { Opener, offerObject } from "poppyio";

	var opener = Opener.any(); // DialogOpener with only default options
	offerObject(opener, {
		kind: "File",
		post: {
			File: {
				location: "https://www.example.com/upload.zip"
			}
		}
	});

```

#### Get the base `DialogOpener` and modify it with `Opener.with()`

This is a shorthand for `Opener.any().with()`.

```
	var opener = Opener.with({ url: "https://www.exmple.com/poppy.html" });
```

# Protocol

Underlying the JavaScript API is a protocol, or rather a set of protocols,
built on top of cross-document messaging, channel messaging, DOM custom events,
cross-origin resource sharing, and web host metadata.

There are basically five steps:

1. Open a popup window
2. Navigate to the poppy URL
3. Establish a connection to the poppy
4. Transfer data over the connection
5. Close the popup

### Launch: Open a popup window

The first thing a client needs to do is open a popup window, since it must be
done synchronously in response to a user action. For safety, the popup
is launched using an `<iframe>` element as its parent with a `sandbox` without
the `allow-top-navigation` permission (where a poppy could navigate the client web page away
from the page they were on while the user wasn't paying attention).

Before opening up the popup, the client gives any browser extension that may
be present the opportunity to intercept the launch. It does this by dispatching
a `CustomEvent` of the type `https://poppy.io/a/open` on the HTML `iframe` sandbox.
The extension listens for this event and invokes `preventDefault()` setting
the `defaultPrevented` property of the event to true, which the client uses to
determine whether to proceed opening the window.

If an extension intercepts launch it also sets the `data-piox-origin` attribute
on the `iframe` indicating the `origin` of the browser extension for cross-document
messaging.

If a browser extension did not intercept the launch, the client opens a popup
window which will host the poppy. If a specific poppy URL is available the
popup is navigated directly to it, otherwise a **Launch Page** is opened
in the popup allowing the user to select a poppy. The user interface may allow
the user to enter the domain name of a poppy, in which case a **Name Resolution**
is performed to determine the poppy URL.

If a browser extension did intercept the launch, the client will inform the
extension of the requested domain or poppy URL in response to a `listen` message,
as part of the **Connect** phase.

### Name Resolution: Navigate to the poppy URL

Name resolution turns a user-entered domain name, e.g. `pickapic.tk` into a
poppy service URL, e.g. `https://pickapic.tk/poppy`. It requires CORS, but if the
Content Security Policy the client web page is under prohibits connections to
arbitrary external servers may be performed server-side.

Given a user-entered domain `example.com`:

1. The client web page makes a cross-origin HTTP request to `https://example.com/.well-known/host-meta.json`
	1. If the file doesn't exist, or CORS headers are not on the `host-meta.json` file
		and it is not available to the client, then the resolution fails.
2. The client web page looks for a `link` in the `host-meta.json` file with the relation of `https://poppy.io/a/poppy`.
	1. If one is found, and there is an `href` for the link, that is the URL of the poppy.
		* The `href` should be an absolute URL.
	2. If one is not found, or there is no `href`, then the resolution fails.

### Matching: Establishing a Connection

Matching is the process of establishing a connection.

A connection is initiated through cross-document messaging. The client maintains
an **Authorized Origin Set**. That is initially the origin of the poppy URL; any
authorized origin may change it if additional origins are required. The client
also always trusts messages from **Trusted Origins**: the origin
of the client and the `data-piox-origin` attribute in the proxy `iframe` set 
by the browser extension if it intercepted the launch.

#### Service: Signal it is `listen`ing

Note the "Service" may not be the final service that the client establishes a
connection with - it may be the browser extension, or the launch page, or any
other intermediate page that helps the user find a final service to use to
perform a desired activity. A client must be able to accept any number of
`listen` messages before a connection is established.

Once a poppy service page is loaded in the poppy, it sends a cross-document `listen` message to its `window.opener`
indicating it is ready and listening. The message has a target origin of `*` and
looks like this:

```
{
	"https://poppy.io/a/to-client": {
		"listen": true
	}
}
```

The service also dispatches a `CustomEvent` of type `https://poppy.io/a/listening` to
it's `window.self` to allow a browser extension to detect it's listening if there
is no `window.opener`.

The client will only accept messages from trusted origins and origins in the authorized set. Initially that is
the origin of the poppy service URL. If other origins need to be trusted, a message
may be sent to the `window.opener` to indicate the new origin set. The message
looks like this and has a target origin of `*`:

```
{
	"https://poppy.io/a/to-client": {
		"origins": ["example.com", "example.org"]
	}
}
```

The `origins` list is the new **Authorized Origins Set**. It does not add to
the existing one, it replaces it.

#### Client: Indicate its `request`

The client rejects any message if it's not from an origin in the **Authorized Origin
Set** and is not from a **Trusted Origin**.

In response to a `listen` message, the clients sends a `request` message
indicating what it is requesting. This will include a **Match Set** indicating
what the client is requesting, a **Control Port** to use to establish a connection,
and, if the message is from a trusted origin a **Launch** to indicate what URL or
domain was requested to be launched.

A client indicates its intent through a **Match Set**, which is a list of
**Match Options**. Each match option indicates a **Protocol**, a **Side** of that
protocol, and a **Hint**.

* A **Protocol** is a string identifying the name of a protocol. For the **Simple
	Offer/Accept Protocol** this is just the kind of object, e.g. a `File`.
* A **Side** is either `accept` or `offer`. Poppy I/O is designed to work with
	direct client-to-client connections where there is no "server" or "client"
	side. So instead of separate protocols for e.g. sending and receiving there
	is just one protocol, the Side indicates whether it is, from a peer's
	perspective, an send or recieve operation.
* A **Hint** is an object that indicates extra information about the capabilities
	or desires of a peer to help determine if a match is suitable.

A match option for a client indicating it wants to `accept` a `File` looks like this:

```
{
	"accept": "File",
	"hint": {
		"types": ["image/*", ".png", ".jpeg", ".jpg", ".gif", ".bmp"]
	}
}
```

A match option for a client indicating it wants to `offer` a `File` looks like this:
```
{
	"accept": "File",
	"hint": {
		"types": ["image/png", ".png"]
	}
}
```

A **Match Set** is an array of these match option objects. A match set may
contain both `offer` and `accept` match options. A protocol may only appear
once as an `offer` or `accept` option but may be both an `offer` and an `accept` -
This is to allow for protocols where there is no logical `offer`
or `accept` side.

The **Launch** for trusted origins includes a `service` indicating the poppy
service URL, a `clientName` with the user-facing name of the client, and an `activityName`
with a user-facing description of what activity is being performed (e.g. picking a photo).

Additionally, a `lang` is sent indicating the language being used.

A full `request` message in response to a `listen` looks like this:

```
{
	"https://poppy.io/a/to-host": {
		"request": [
			{
				"accept": "File",
				"hint": {
					"types": ["image/*", ".png", ".jpeg", ".jpg", ".gif", ".bmp"]
				}
			},
		],
		"launch": {
			"activityName": "Pick a Photo"
		},
		"lang": "en"
	}
}

```

Finally, a `MessageChannel` is created and one `MessagePort` is sent along
with the message back to the Service. This `MessagePort` is the **Connect
Port** which is used to establish a connection.

The `request` is sent in a cross-document message to the `source` of the
triggering `listen` message. This may not be the popup window, or if there
is a browser extension involved, there may not be a popup at all. The
target `origin` of the message is the `origin` of the triggering `listen`
message.

Client pages may receive any number of `listen` messages and must reply to
each of them with a `request`.

#### Service: Connect

The service examines the **Match Set** and determines if it is able to service
the request. It is able to service the request if it supports one of the protocols
in the matchlist from the other side - if it is able to accept a protocol the
client is offering, or offer a protocol the client is accepting. Further it may
examine the `hint` object in the **Match Option**.

Once a service can commit to handling a request, it sends a `connect` message
back to the client. This message is sent using the **Control Port** that the
client provided with the `request` message. The message also includes another
`MessagePort`, a **Data Port** which is used for the actual data transfer between
the client and the service.

Aside from the **Data Port**, the message includes:

* The **Data Protocol** which is the protocol to use over the **Data Port**, and which side the service will
	assume, indicated by setting the `accept` or `offer` property on the message
	to the Data Protocol  name.
* A response **Match Set** which will include a **Match Option** for the **Data Protocol**,
	which is where the `hint` for the data protocol will go. The Match Set may
	include other match options for other protocols the client requested.

A `connect` message looks like this:
```
{
	"connect": true,
	"offer": "File",
	"matchset": [
		{
			"offer": "File",
			"hint": {
				"types": ["image/png"]
			}
		}
	]
}
```

Once the client recieves the `connect` message, both client and service have
a direct `MessageChannel` over which to send data, and a matching accept/offer
pair and a **session** is established. 

#### Client/Service: The Session

The **simple offer/exchange protocol** ("SOAP") is the standard means of transferring
data using Poppy I/O using the data port. However, any protocol may be used if
both sides agree to it.

The protocol has four steps:

1. The `offer` side sends a message to the `accept` side over the data channel containing the **object**, along with any message ports.
2. The `accept` side sends a response message to the `offer` side over the data channel, which may contain no data.
3. The `offer` side sends a **release** message to the `accept` side over the data channel, indicating it
	has received the reply and the channel can be closed. The contents of the message are ignored.
4. The `accept` sends a message consisting of the string `release` on the control channel.

The reason for step 3 is to prevent a service poppy from closing too
soon. The client may detect the popup closing before the response is received,
in which case it may ignore the message because it thinks the client is closed.

Step 4 is to signal the session may be closed. However, in a client/poppy exchange,
the poppy always closes the session unless there is an error causing the session
to be **cancelled**, and the service knows based on the data channel exchange 
that closing the session is safe. This is because the poppy is what the user is interacting
with and may have information it needs to display to the user. Step 4 is for
direct client-to-client sessions. In that case, the "service" role is assumed
by an intermedary (e.g. a browser extension) and needs to be informed it's time
to close the session.

#### Non-SOAP exchanges

If `offer` and `accept` may be for a protocol that does not use SOAP. In that case,
one side must send a `release` message on the control channel to indicate it is
safe to close the session to any intermediary if the session is a client-to-client
peer-to-peer exchange.

#### Service: Close the Session

After the primary exchange is complete, the poppy may close automatically, or
it may stay open if it has extra information to display to the user. The client
should not close the session, or the dialog, unless there is an error. In the
event that the client does close the dialog, it should display a message to the
user explaining why.
