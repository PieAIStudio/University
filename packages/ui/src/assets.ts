/** Bundlers emit a URL for the brand package's referenced image, not its bytes. */
declare module "@pieai/swimmer-ui-kit/assets/*.png" {
  const url: string;
  export default url;
}
