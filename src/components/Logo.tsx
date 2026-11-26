// The NITCO logo (black on light backgrounds, white in dark mode). Files in /public are made from the logo the
// business owner supplied (public/nitco-logo-src.png): "wordmark" is NITCO alone, "logo" includes TILES MARBLE MOSAICO.
export function NitcoLogo({ full = false, height }: { full?: boolean; height: number }) {
  const name = full ? "nitco-logo" : "nitco-wordmark";
  const ratio = full ? 474 / 174 : 474 / 118;
  return (
    <picture>
      <source srcSet={`/${name}-white.png`} media="(prefers-color-scheme: dark)" />
      {/* eslint-disable-next-line @next/next/no-img-element -- a static logo, no optimisation needed */}
      <img src={`/${name}.png`} alt="NITCO" height={height} width={Math.round(height * ratio)} style={{ height, width: "auto" }} />
    </picture>
  );
}
