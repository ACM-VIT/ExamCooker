
export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 50,
        color: 'white',
      }}
    >
      <div className="flex justify-center">
        <p>Loading...</p>
      </div>
    </div>
  );
}