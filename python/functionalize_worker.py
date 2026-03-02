#!/usr/bin/env python3
import json, sys
import numpy as np
from numpy.linalg import inv

# scikit-fda
from skfda.representation.basis import BSplineBasis, FourierBasis

def build_grid(domain):
    start = float(domain["startWavelength"])
    step = float(domain["stepSize"])
    n = int(domain["nPoints"])
    # grid explícito del dominio (no rehacemos con endWavelength para evitar off-by-one)
    return np.array([start + i * step for i in range(n)], dtype=float)

def _to_2d_mat(M_expected, arr):
    """
    Normaliza la salida de evaluación de base a shape (M, P).
    """
    A = np.asarray(arr, dtype=float)
    # Casos habituales en scikit-fda:
    # - (M, P)
    # - (M, P, 1)
    # - (P, M)  (según versión)
    # - (M,)    (si P == 1)
    if A.ndim == 3 and A.shape[-1] == 1:
        A = A[:, :, 0]                # (M, P, 1) -> (M, P)
    if A.ndim == 1:
        A = A[:, None]                # (M,) -> (M, 1)

    # Si no coincide M en la primera dimensión pero sí en la segunda, lo transponemos.
    if A.shape[0] != M_expected and A.shape[1] == M_expected:
        A = A.T

    # En este punto esperamos (M, P)
    if A.shape[0] != M_expected:
        raise ValueError(f"Basis eval has unexpected shape {A.shape}; expected first dim M={M_expected}")
    return A

def eval_basis_matrix(basis, grid, derivative=0):
    """
    Evaluación robusta de la base garantizando (M, P).
    Evita método deprecado .evaluate().
    """
    M = len(grid)
    try:
        B = basis(grid, derivative=derivative)  # notación recomendada
    except TypeError:
        # fallback por compatibilidad (no debería usarse ya)
        B = basis.evaluate(grid, derivative=derivative)
    return _to_2d_mat(M, B)

def make_basis(basis_type, t0, t1, n_basis):
    if basis_type == "bspline":
        return BSplineBasis(domain_range=(t0, t1), n_basis=int(n_basis), order=4)  # cúbica
    elif basis_type == "fourier":
        return FourierBasis(domain_range=(t0, t1), n_basis=int(n_basis))
    else:
        return None  # wavelet: sin GCV exacto en este worker

def penalty_matrix_second_derivative(basis, grid):
    """
    R ≈ ∫ (D²Φ)^T (D²Φ) dt  ≈  B2^T W B2  con trapecios no uniformes.
    """
    B2 = eval_basis_matrix(basis, grid, derivative=2)   # (M, P)

    # pesos de trapecios para malla potencialmente no uniforme
    dx = np.diff(grid)
    w = np.zeros(len(grid))
    if len(grid) >= 2:
        w[0] = dx[0] / 2.0
        w[-1] = dx[-1] / 2.0
    if len(grid) > 2:
        w[1:-1] = (dx[:-1] + dx[1:]) / 2.0

    W = np.diag(w)                 # (M, M)
    R = B2.T @ W @ B2              # (P, P)
    R = R + 1e-10 * np.eye(R.shape[0])  # estabilización numérica mínima
    return R

def smooth_penalized(Y, basis, lam, grid):
    """
    Penalized least squares: coefs = (B^T B + λ R)^(-1) B^T Y
    """
    B = eval_basis_matrix(basis, grid, derivative=0)  # (M, P)
    BtB = B.T @ B                                     # (P, P)
    R = penalty_matrix_second_derivative(basis, grid) # (P, P)
    A = BtB + lam * R                                 # (P, P)
    Ainv = inv(A)

    # Y: (N, M)  -> coefs: (N, P)
    coefs = (Ainv @ B.T @ Y.T).T
    # Fitted: (N, M)
    Y_hat = (B @ coefs.T).T

    # Hat matrix H común al grid: (M, M)
    H = B @ Ainv @ B.T
    return Y_hat, coefs, H

def metrics_global(Y, Y_hat):
    resid = Y - Y_hat
    rmse = float(np.sqrt(np.mean(resid**2)))
    ymean = np.mean(Y)
    ss_res = float(np.sum((Y - Y_hat)**2))
    ss_tot = float(np.sum((Y - ymean)**2))
    r2 = 1.0 - (ss_res / ss_tot if ss_tot > 0 else 0.0)
    return rmse, max(0.0, r2)

def gcv_from_hat(Y, Y_hat, H):
    """
    GCV medio por curva en grid regular con H común:
      GCVi = ((M+1) * MSE_i) / (trace(I - H))^2
    """
    N, M = Y.shape
    mse_i = np.mean((Y - Y_hat)**2, axis=1)  # (N,)
    tr = np.trace(np.eye(M) - H)
    tr2 = (tr ** 2) if tr > 1e-12 else 1e-12
    gcv_i = ((M + 1) * mse_i) / tr2
    return float(np.mean(gcv_i))

def handle_functionalize(payload):
    raw = np.array(payload["rawData"], dtype=float)  # (N, M)
    domain = payload["domain"]
    params = payload["params"]
    basis_type = params["basisType"]
    n_basis = int(params["nBasis"])
    lam = float(params["lambda"])

    grid = build_grid(domain)
    t0, t1 = float(grid[0]), float(grid[-1])

    if basis_type in ("bspline", "fourier"):
        basis = make_basis(basis_type, t0, t1, n_basis)
        Y_hat, coefs, _ = smooth_penalized(raw, basis, lam, grid)
    else:
        # Wavelet: mantener contrato sin GCV exacto
        Y_hat = raw.copy()
        coefs = np.zeros((raw.shape[0], n_basis))

    rmse, r2 = metrics_global(raw, Y_hat)
    return {
        "data": Y_hat.tolist(),
        "coefficients": coefs.tolist(),
        "parameters": { **params, "domain": domain, "nSpectra": int(raw.shape[0]) },
        "metrics": {"rmse": rmse, "r2": r2},
        "meta": {"basisType": basis_type, "nBasis": n_basis, "lambda": lam}
    }

def handle_gcv(payload):
    raw = np.array(payload["rawData"], dtype=float)
    domain = payload["domain"]
    basis_type = payload["basisType"]
    n_basis = int(payload["nBasis"])
    rng = payload.get("range", {"start": 0.01, "stop": 5.0, "step": 0.01})

    if basis_type not in ("bspline", "fourier"):
        # GCV fiable sólo para bases lineales con penalización definida
        return {"lambda_opt": float(rng["start"]), "boundary": True, "lambda_grid": [], "gcv_values": []}

    grid = build_grid(domain)
    t0, t1 = float(grid[0]), float(grid[-1])
    basis = make_basis(basis_type, t0, t1, n_basis)

    lam_grid = np.round(np.arange(rng["start"], rng["stop"] + 1e-12, rng["step"]), 2)
    gcv_vals = []
    for lam in lam_grid:
        Y_hat, _, H = smooth_penalized(raw, basis, float(lam), grid)
        gcv_vals.append(gcv_from_hat(raw, Y_hat, H))

    gcv_vals = np.array(gcv_vals, dtype=float)
    idx = int(np.argmin(gcv_vals))
    lam_star = float(lam_grid[idx])
    boundary = (idx == 0) or (idx == len(lam_grid) - 1)
    return {
        "lambda_opt": lam_star,
        "boundary": bool(boundary),
        "lambda_grid": lam_grid.tolist(),
        "gcv_values": gcv_vals.tolist()
    }

if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    action = data.get("action")
    if action == "functionalize":
        out = handle_functionalize(data)
    elif action == "gcv":
        out = handle_gcv(data)
    else:
        out = {"error": "unknown action"}
    sys.stdout.write(json.dumps(out))
