/** Animated perspective grid used behind menus. */
export const MenuBackground = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(76,29,149,0.45),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(8,145,178,0.35),transparent_55%)]" />
    <div className="absolute inset-x-[-50%] bottom-[-10%] h-[70%] [perspective:500px]">
      <div className="cyber-grid animate-grid-scroll h-full w-full origin-bottom [transform:rotateX(62deg)] [mask-image:linear-gradient(to_top,black,transparent)]" />
    </div>
    <div className="scanlines absolute inset-0 opacity-60" />
  </div>
);
