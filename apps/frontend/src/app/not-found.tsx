import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-4">
      <h1 className="display-4">404</h1>
      <p className="text-muted mb-4">This page could not be found.</p>
      <Link href="/" className="btn btn-primary">
        Go home
      </Link>
    </div>
  );
}
