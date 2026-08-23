/**
 * Vite handles the CSS. tsc does not, and a side-effect import of
 * `planet-page.css` is how the page stays self-contained when a shell
 * mounts it without remembering a second stylesheet.
 */
declare module "*.css";
