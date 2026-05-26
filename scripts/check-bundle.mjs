import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const INDEX_HTML = join(DIST_DIR, 'index.html');
const MAX_MAIN_SHELL_BYTES = 275 * 1024;

const formatKb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;

const findMainShellAsset = async () => {
  const html = await readFile(INDEX_HTML, 'utf8');
  const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/);
  if (!match) {
    throw new Error(`Unable to find the main module script in ${INDEX_HTML}. Run npm run build first.`);
  }
  return match[1].replace(/^\/?meu-treino-abb\//, '').replace(/^\//, '');
};

const mainAsset = await findMainShellAsset();
const assetPath = join(DIST_DIR, mainAsset);
const { size } = await stat(assetPath);

if (size > MAX_MAIN_SHELL_BYTES) {
  console.error(
    `Main app shell is ${formatKb(size)}, above the ${formatKb(MAX_MAIN_SHELL_BYTES)} budget: ${assetPath}`,
  );
  process.exit(1);
}

console.log(`Main app shell ${formatKb(size)} within ${formatKb(MAX_MAIN_SHELL_BYTES)} budget: ${assetPath}`);
