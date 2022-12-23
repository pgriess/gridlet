Control system for a very small (e.g. home-sized) grid.

# Design

This is implemented in JavaScript by APIs that have browser-native equivalents (e.g. we use a polyfill to provide `DOMParser` to Node). The idea is that it should be possible to run this as a PWA. Does this actually matter? Probably not, but it's a fun thought experiment.

# Installing

Install [direnv](https://direnv.net/).

Install [nvm](https://github.com/nvm-sh/nvm).

Install NodeJS via `nvm`. Do this from the repository clone, as it will read the `.nvmrc` file there.

```
nvm install
```

Install JavaScript dependencies

```
npm i
```

Install the package itself

```
npm link .
```

# Running

```
gridlet --help
usage: gridlet [-h] [-u <username>] [-p <password>]

The command line interface to Gridlet.

optional arguments:
  -h, --help     show this help message and exit
  -u <username>  Enphase username
  -p <password>  Enphase password
```

## Debugging with Charles

Set up Charles in Reverse Proxy mode (Proxy -> Reverse Proxies) and add a mapping to `enlighten.enphaseenergy.com:443`.

Override `ENPHASE_BASE_URL` in `enphase.js` to the Charles URL, e.g. https://localhost:54532

Run with the `NODE_TLS_REJECT_UNAUTHORIZED=0` environment variable set, which will disable TLS validation

# Testing

## Unit tests

Unit tests can be run using `npm test`.

Tests can also be run (and debugged!) from VS Code using the "Mocha tests" launch target.
