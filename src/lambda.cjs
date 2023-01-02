// AWS Lambda driver for the Gridlet system
//
// NOTE: The .cjs suffix for this file causes NodeJS to consider this a CommonJS
//       file rather than an ESM module. This is needed as the AWS Runtime Interface
//       expects to be able to `require()` our handler.
"use strict";

exports.handler = async (event, context) => {
    return 'Hello World!';
}
