Control system for a very small (e.g. home-sized) grid.

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
pig --help
usage: pig [-h] [-u <username>] [-p <password>]

The command line interface to Picogrid.

optional arguments:
  -h, --help     show this help message and exit
  -u <username>  Enphase username
  -p <password>  Enphase password
```

## Debugging with Charles


Set up Charles in Reverse Proxy mode (Proxy -> Reverse Proxies) and add a mapping to `enlighten.enphaseenergy.com:443`.

Override `ENPHASE_BASE_URL` in `enphase.js` to the Charles URL, e.g. https://localhost:54532

Run with the `NODE_TLS_REJECT_UNAUTHORIZED=0` environment variable set, which will disable TLS validation
