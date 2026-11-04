interface ToastProps {
  text: string | null;
}

export const Toast = ({ text }: ToastProps) =>
  text ? (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <div key={text} className="glass clip-corner animate-pop-in px-5 py-2.5 font-display text-sm uppercase tracking-widest text-cyan-100">
        {text}
      </div>
    </div>
  ) : null;
