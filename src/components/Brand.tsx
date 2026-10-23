export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand ${inverse ? "brand-inverse" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M5 5h6v6H5zM14 5h5v6h-5zM5 14h6v5H5z" fill="currentColor" /><path d="m14 16 2 2 4-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className="brand-name">gop<span>.</span><small>Gestão de presenças</small></span>
    </span>
  );
}
