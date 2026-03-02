"""
ANOVA Funcional - Backend Python
---------------------------------
Script Python para calcular medias por grupo y estadísticos básicos de ANOVA funcional.
Versión simplificada que calcula manualmente las curvas medias por grupo y estadísticos F.
"""

import sys
import json
import numpy as np
import pandas as pd


def to_jsonable(x):
    """Convierte tipos de numpy a tipos Python serializables a JSON."""
    if isinstance(x, np.ndarray):
        return x.tolist()
    if isinstance(x, (np.float32, np.float64)):
        return float(x)
    if isinstance(x, (np.int32, np.int64)):
        return int(x)
    return x


def compute_f_statistic(curves, groups):
    """
    Calcula el estadístico F funcional manualmente.
    
    En cada punto t, calcula F(t) = (varianza entre grupos) / (varianza dentro de grupos)
    """
    unique_groups = np.unique(groups)
    n, p = curves.shape
    
    # Media global en cada punto
    overall_mean = curves.mean(axis=0)
    
    # Suma de cuadrados entre grupos en cada punto
    between_ss = np.zeros(p)
    for g in unique_groups:
        group_idx = groups == g
        n_group = np.sum(group_idx)
        if n_group > 0:
            group_mean = curves[group_idx].mean(axis=0)
            between_ss += n_group * (group_mean - overall_mean) ** 2
    
    # Suma de cuadrados dentro de grupos en cada punto
    within_ss = np.zeros(p)
    for i in range(n):
        within_ss += (curves[i] - curves[groups == groups[i]].mean(axis=0)) ** 2
    
    # Estadístico F en cada punto
    # F = (between_ss / (k-1)) / (within_ss / (n-k))
    k = len(unique_groups)
    f_statistic = np.zeros(p)
    for j in range(p):
        df_between = k - 1
        df_within = n - k
        if within_ss[j] > 1e-10 and df_within > 0:
            f_statistic[j] = (between_ss[j] / df_between) / (within_ss[j] / df_within)
        else:
            f_statistic[j] = 0.0
    
    return f_statistic


def main():
    # Lee el payload desde stdin (enviado por la ruta API de Next.js)
    payload = json.loads(sys.stdin.read())
    curves = np.array(payload["curves"], dtype=float)  # n×p
    grid = payload.get("grid", None)
    groups = np.array(payload["groups"])

    n, p = curves.shape
    
    # Grid por defecto si no se proporciona
    if grid is None or len(grid) != p:
        grid = np.linspace(0, 1, p)
    
    # Convertir a array numpy si es necesario
    if isinstance(grid, list):
        grid = np.array(grid)

    # Calcular el estadístico F funcional manualmente
    f_curve = compute_f_statistic(curves, groups)
    
    # Extraer los niveles únicos de grupos
    uniq = pd.Index(groups).unique()
    
    # Calcular las medias por grupo
    group_means = {}
    for g in uniq:
        idx = np.where(groups == g)[0]
        group_means[str(g)] = curves[idx].mean(axis=0).tolist()
    
    # Nota: Calculamos un estadístico F funcional pero no un p-valor
    # Un p-valor apropiado para ANOVA funcional requeriría pruebas más complejas
    p_value = None  # No se calcula en la versión simplificada

    # Construir la salida
    out = {
        "ok": True,
        "n_obs": int(n),
        "p_grid": int(p),
        "grid": to_jsonable(grid),
        "p_value": p_value,
        "f_statistic": f_curve.tolist(),
        "group_means": group_means,
        "groups_levels": [str(u) for u in uniq],
    }
    
    # Imprimir JSON a stdout para que Next.js lo capture
    print(json.dumps(out))


if __name__ == "__main__":
    main()
