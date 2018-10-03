**Note:** The files you see here aren't the `poppyio` package, they're the files
used to build the `poppyio` package. To do that run `npm run build`; the generated
package will be in the `target/` directory.

You can also browse the contents of the package at https://js.poppy.io/0.0.6/

----------------------------------------
# Poppy I/O

*Note: This README, and Poppy I/O in general, is an early work in progress. It's
definitely incomplete and the parts that aren't are probably wrong.*

Poppy I/O is an idea for making it easier for web applications to work together.

It's a simple API for sending files and other kinds of data between web
applications. What makes it simple is that the client app doesn't communicate
directly with a service's API servers. Instead, the service app provides a mini-UI
called a **poppy** that the client app opens in a popup dialog window which guides
the user through all the service-specific authentication and navigation. All the
client app has to do is send or receive a data message - the poppy handles the rest.

This kind of thing exists already - for example the
[Dropbox Chooser](https://www.dropbox.com/developers/chooser) for picking files
to use in your app, or [Twitter Web Intents](https://dev.twitter.com/web/intents)
for sharing links to Twitter. But although the actions they perform and interface
they provide are fairly generic, the actual implementation is service-specific.

The idea of Poppy I/O is to define a generic API to allow any client to connect
to any service, even clients and services that know nothing about each other.
And beyond that, if clients are able to connect to arbitrary services, to define
a way to let the *user* pick their own services to use. 

The end goal then is something like Android's
[Intent](https://developer.android.com/guide/components/intents-filters.html)
system, but for the web. A "[Web Intents](https://github.com/PaulKinlan/WebIntents)"
if you will. :)

Here's what it looks like.

```html
<button id='pickButton'>Pick Photo</button>
<script type='module'>
  import Poppy from "https://js.poppy.io/0.0.6/use-en.mjs";
  pickButton.onclick = async () => {
    let pick = await Poppy.accept("image/*");
    if (pick) {
      let img = new Image;
      img.src = pick.data.location || URL.createObjectURL(pick.data.contents);
      document.body.appendChild(img);
    }
  }
</script>
```

But you don't need a browser that supports ES modules or `async`/`await` for
Poppy I/O to work; here's the same code in more conventional ES5.

```html
<script src="https://js.poppy.io/0.0.6/bundle/poppyio.en.min.js"></script>
<script>
  Poppy.any().iePrelude = "/"; // hack for Internet Explorer 10
  pickButton.onclick = function () {
    Poppy.accept("image/*").then(function (pick) {
      if (pick) {
        var img = new Image;
        img.src = pick.data.location || URL.createObjectURL(pick.data.contents);
        document.body.appendChild(img);
      }
    });
  }
</script>
```

Poppy I/O should support any browser that supports channel messaging,
which is [almost all of them](https://caniuse.com/#feat=channel-messaging).
Internet Explorer requires a `Promise` polyfill (the bundles come with [promiscuous](https://github.com/RubenVerborgh/promiscuous)) and a
[small hack](https://stackoverflow.com/a/36630058) (the `iePrelude` above).

## Try it

Check out https://primitive.5apps.com for an example client app. For a poppy to use, try:

* `f4r.poppy.io` to pick an image from the Flickr Commons or upload an image to your Flickr account
* `i3r.poppy.io` to anonymously upload an image to imgur.

## README Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [The Elements of Poppy I/O](#the-elements-of-poppy-io)
  - [Naming](#naming)
- [Using Poppy I/O](#using-poppy-io)
  - [Requirements](#requirements)
    - [Web Browsers](#web-browsers)
    - [Servers](#servers)
  - [Getting `poppyio`](#getting-poppyio)
  - [Picking a file from a Poppy](#picking-a-file-from-a-poppy)
    - [Client side](#client-side)
      - [Letting the user pick a poppy](#letting-the-user-pick-a-poppy)
      - [Using a specific poppy](#using-a-specific-poppy)
    - [Service Side](#service-side)
      - [The `host-meta.json` file](#the-host-metajson-file)
      - [Listening for a request](#listening-for-a-request)
      - [Sending the object](#sending-the-object)
    - [Saving a file to a poppy](#saving-a-file-to-a-poppy)
- [The Protocol](#the-protocol)
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



# The Elements of Poppy I/O

Poppy I/O is all about two webpages, one of which has something to **offer**
which the other page **accepts**. One of those
pages is the **client** application - the page the user is already on - and the other is
the **poppy** - a service webpage that launches in a popup **dialog window** to perform
some action on behalf of the client page.

That action might be something like:
* Picking a file to use in the app. *The client accepts a file offered by the poppy.*
* Saving a file they created in the app. *The poppy accepts a file offered by the client.*
* Sharing a link. *The poppy accepts a link offered by the client.*

The client might start out with a specific poppy in mind, in which case it just opens up
its URL in the dialog window. But the Poppy I/O ideal is that *the user gets
to pick the poppy.*

How the user picks their poppy is through the **launcher**. This is a page that opens
up inside the dialog window if the client app doesn't open a specific poppy. It
provides a user interface to let the user pick one instead.

The launcher would ideally be something provided in the user's browser, and
Poppy I/O is designed to work with an optional **browser extension** to provide that
(it only exists as a proof of concept at this point).

But without a browser extension, the client can provide a launcher of its own,
or delegate it to a centralized directory launcher. To allow users to select
poppies not in any directory, there's a **domain resolution procedure** to take
a user-entered domain name and determine if there's a poppy at the domain, and what
its URL is. (The `poppyio` JavaScript library includes a minimal embedded "starter" launcher).

*Note that it can be dangerous to send the user to a poppy by domain name if
the user enters it incorrectly - for example if they intend to upload a file to
`dropbox.com` but accidentally type `dropbox.cm` and send the file there instead -
so a safety check should be performed on any entered domain, Poppy I/O
includes a feature called **Namecheck** where services can provide digital
certificates signed by some authority verifying a domain as not misleading.
That authority is currently me.*

So an example of how things might work would be:
1. You've signed up to a website and want to upload a profile photo.
2. You see the site lets you do that using Poppy I/O, and click the "Pick From Poppy" button.
3. You don't have a Poppy I/O browser extension installed (because one doesn't exist yet), 
  but the launcher provided by the website lets you enter the domain of the poppy you want.
4. You keep your photos on your own [Nextcloud](https://nextcloud.com/) install
  with a Poppy I/O app (which also doesn't exist yet), so you type in the domain of your VPS.
5. The launcher throws up a scary warning about the name being unverified.
6. But you expected that since you never submitted it for Namecheck, so you click "I
  understand the risks" or whatever and get sent to your Nextcloud poppy.
7. You pick the photo you want.
8. The photo gets sent back to the setup page and the poppy closes automatically.

## Naming

This has changed before and might change again, but for now:

* **Poppy.io** is the name of the project and its website domain name.
* **Poppy I/O** is the set of protocols and general concept.
* **`poppyio`** is the JavaScript library implementing Poppy I/O.
* A **poppy** is a Poppy I/O service web page.

Poppy I/O isn't related to the [Poppy robotics project](https://www.poppy-project.org).

# Using Poppy I/O

## Requirements

### Web Browsers

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

### Servers

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
## Getting `poppyio`

`poppyio` isn't ready to be published to `npm`,
but you can still add it as a dependency to your `package.json`. The package
contains both ES modules in `.mjs` files and CommonJS ES5 modules in adjacent
`.js` files. AMD versions of the modules are under the `amd` directory.
```
  $ npm install https://js.poppy.io/0.0.6/poppyio-0.0.6.tgz
```
You can also `bower install` the same URL if you use Bower.

The simplest way to get started is to use the browser bundle. Everything get
exported to the `poppyio` global namespace:
```html
  <script src="https://js.poppy.io/0.0.6/bundle/poppyio.en.js"></script>
```

`import` or `require` the `"use-en"` module (in whatever format you're using)
to include the English language user interface for the launcher. The browser
bundle already has it (which is why there's an `en` in the name). If you're
using a module format you'll have to add a `Promise` polyfill for Internet
Explorer support. The bundle already includes one.

The examples will assume you're using the browser bundle.

## Picking a file from a Poppy

### Client side

#### Letting the user pick a poppy

The entry point to `poppyio` from the client side is the `Poppy` class.

```js
// import Poppy from "poppio/use-en"
// var Poppy = require("poppyio/use-en").default;
function pick() {
  Poppy.accept("image/*")
    .then(function (file) {
      if (file) console.log(file.data.location || file.data.contents && "Got Blob");
    })
    .catch(function (error) {
      console.error(error);
    });
}
```

`Poppy.accept()` lets you ask for an object. You specify what kind of object in
the first parameter. It can be a string

```js
Poppy.accept("image/*")
```
Or a list of strings.
```js
Poppy.accept(["image/*", ".png", ".jpeg", ".jpg", ".gif", ".bmp"])
```
Different types should be listed in order of preference from most desired to least.

It may also be an object. The object lets you specify extra information about what you
support, for example if you will accept URLs that don't offer CORS:

```js
Poppy.accept({kind:["image/*", ".png", ".jpeg", ".jpg", ".gif", ".bmp"], noCors: true})
```

You can use both file extensions and MIME media types to identify what kind of
file you want, since not every cloud drive will know exactly what MIME
type every file is. Note that the MIME type is only advisory, so be sure to
check that the file you get is the kind of file you want.

`Poppy.accept()` returns a `Promise` for an object that contains what was
accepted. It may resolve to `undefined` if the poppy never offered anything.
That might be because the user cancelled before picking anything, or it also
could be because the poppy that was chosen didn't have anything to offer.

The object the poppy offered to you is stored in the `data` property. You can send any kind of
object with Poppy I/O - not just files - and what that `data` property contains
would depend on what kind of object is sent. But for files it will look like
this:
```js
  {
    // One of the following is required
    location: // a URL to use to download the file. Will support anonymous CORS.
    contents: // a Blob containing the file data

    // Optional
    filename: // The file name
    hotlink: // "prohibited", "permitted", or "perferred"

    // Optional Dublin Core metadata. http://dublincore.org/documents/dces/
    format: // content type
    title: // title
    description: // description
    // etc...
  }
```

#### Using a specific poppy

The `Poppy.accept()` method is short for `Poppy.any().accept()`. What `Poppy.any()`
does is return a `base` poppy opener set up by the `"use-en"` module.
You can customize this object using the `with()` method. You can use the
`url` property to specify the URL of the poppy.

```js
poppyio.Poppy.with({ url: "https://www.example.com/poppy" }).accept("image/*")
```

`Poppy.with()` is in turn short for `Poppy.any().with()`. The `with()` method
returns a new object that uses the object you called it on as its prototype,
as a template basically.

Poppy opener objects can be re-used to open as many poppies as you want.

### Service Side

#### The `host-meta.json` file

If you want users to be able to launch your poppy by domain name, you have to
have a [JRD](https://tools.ietf.org/html/rfc6415#appendix-A)
file at `/.well-known/host-meta.json`  on your server that includes a
link to the poppy dialog page. Since it may be accessed directly by client-side
JavaScript, it has to be accessible via anonymous CORS.

The file looks like this:

```json
{
  "links": [
    {
      "rel": "https://poppy.io/a/poppy",
      "href": "/poppy.html"
    }
  ]
}
```
The `href` should be absolute if possible, but a relative URL will work if
your domain only contains ASCII characters. It's the URL of the poppy.

#### Listening for a request

The entry point to `poppyio` from the service/poppy side is the `PoppyService`
class. Poppy I/O works asynchronously, so you provide a callback that will be
notified when we know there's a client. You can tell if the client is accepting
something with the `client.accepts()` method.

```js
// import PoppyService from "poppyio/poppy-service"
// var PoppyService = require("poppyio/poppy-service").default;
poppyio.PoppyService.onClient(function (client, error) {
  // showError and showPickUi are placeholders for your own implementation.
  if (error) {
    showError(error.message || error);
  } else if (client.accepts("File")) {
    showPickUi();
  } else {
    showError("The client isn't accepting a file");
  }
});
```

The `client` object passed to the callback is also saved in the `PoppyService.client`
static variable.

You should only call `PoppyService.onClient()` once per page, but can call
it as many times as you want on different pages until you actually connect
to the client. So the poppy doesn't have to be a single-page application.

#### Sending the object

Once the user has selected a file to use, the poppy sends it back to the client
with the `client.offer()` method. 

```js
function sendPhoto() {
  // showError is a placeholder for your own implementation
  poppyio.PoppyService.client.offer("image/png", {
    location: "https://www.example.com/photo.png",
    title: "A sample photo"
  }).then(function () {
    PoppyService.close();
  }).catch(function (error) {
    showError(error.message || error);
  });
}
```
The first parameter is the same as that of the `Poppy.accept()` method - the
kind of thing you are sending. The second parameter is the object to send to
the client. It can also be a function that returns the object to send, or a `Promise` that
resolves with the object to send, or a function that returns a `Promise` that
resolves with the object to send.

The `offer()` method returns a `Promise` that resolves after the transfer is
complete. It's the poppy's responsibility to close itself afterwards - it may
also stay open after the transfer is complete if it needs to show some information
to the user. You can do that with `window.close()` but should use `PoppyService.close()`.

If there's an error the poppy should show an error message instead of just closing;
otherwise the poppy will disappear without any indication that something went wrong.

### Saving a file to a poppy

TODO

# The Protocol

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
