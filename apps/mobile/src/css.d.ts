/**
 * Expo bundles CSS for the web target and ignores it on native; TypeScript
 * still needs a module declaration for the side-effect import.
 */
declare module '*.css';
