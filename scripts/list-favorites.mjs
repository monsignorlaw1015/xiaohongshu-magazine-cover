import { readFavorites } from './xhs-cover-server.mjs';

const favorites = await readFavorites();

process.stdout.write(`${JSON.stringify({ favorites }, null, 2)}\n`);
