export default function Home() {
  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="t" style={{ margin: 0, fontSize: 30 }}>Quiet Ledger</h1>
      <p style={{ margin: 0, color: 'var(--c-meta)' }}>
        Scaffold up. Tokens generated from the canvas. Schema and invariants migrated.
      </p>
    </main>
  );
}
