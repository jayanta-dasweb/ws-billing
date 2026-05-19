'use client';

import Link from 'next/link';

export function PortalLanding() {
  return (
    <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light px-3 py-4">
      <div className="text-center mb-4">
        <h1 className="h2 font-weight-bold text-dark mb-1">
          <b>Billing</b> POS
        </h1>
        <p className="text-muted mb-0">Choose how you want to sign in</p>
      </div>

      <div className="container" style={{ maxWidth: 920 }}>
        <div className="row">
          <div className="col-md-6 mb-4 mb-md-0">
            <Link
              href="/customer/login"
              className="text-decoration-none d-block h-100"
              prefetch={false}
            >
              <div className="card h-100 shadow border-0 portal-choice portal-choice--customer">
                <div className="card-body d-flex flex-column align-items-center justify-content-center text-center p-4 p-md-5">
                  <span className="portal-choice__icon text-success mb-3" aria-hidden>
                    <i className="fas fa-user-circle fa-4x" />
                  </span>
                  <h2 className="h3 font-weight-bold text-dark mb-2">Customer</h2>
                  <p className="text-muted mb-0 lead" style={{ fontSize: '1rem' }}>
                    View your bills and receipts — sign in with your mobile number
                  </p>
                  <span className="btn btn-success btn-lg mt-4 px-5">Continue</span>
                </div>
              </div>
            </Link>
          </div>

          <div className="col-md-6">
            <Link href="/login" className="text-decoration-none d-block h-100" prefetch={false}>
              <div className="card h-100 shadow border-0 portal-choice portal-choice--staff">
                <div className="card-body d-flex flex-column align-items-center justify-content-center text-center p-4 p-md-5">
                  <span className="portal-choice__icon text-primary mb-3" aria-hidden>
                    <i className="fas fa-store fa-4x" />
                  </span>
                  <h2 className="h3 font-weight-bold text-dark mb-2">Staff</h2>
                  <p className="text-muted mb-0 lead" style={{ fontSize: '1rem' }}>
                    Billing counter, masters and admin — sign in with your username
                  </p>
                  <span className="btn btn-primary btn-lg mt-4 px-5">Continue</span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
