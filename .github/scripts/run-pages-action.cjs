'use strict';

if (process.versions.node !== '24.22.1') {
  throw new Error(`Expected patched Node 24.22.1, received ${process.versions.node}`);
}
console.log(`Verified container Node ${process.versions.node}`);
import(process.env.PAGES_ACTION_ENTRYPOINT).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
