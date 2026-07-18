/** Vite `?raw` imports of markdown sources (used by the Methods page). */
declare module '*.md?raw' {
  const content: string;
  export default content;
}
