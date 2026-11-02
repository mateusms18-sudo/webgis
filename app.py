#!/usr/bin/env python3
"""Servidor local do Atlas WebGIS do COREDE Centro-Sul.

Usa apenas a biblioteca padrão do Python. O mapa e a interface ficam no
navegador (HTML, CSS e JavaScript); este servidor entrega os arquivos e os
dados municipais locais por uma API simples.
"""

from __future__ import annotations

import argparse
import csv
import errno
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"
INDICATORS_FILE = DATA_DIR / "indicadores_sidra.csv"
BOUNDARIES_FILE = DATA_DIR / "municipios_corede_centro_sul.geojson"


def parse_number(value: str) -> float | None:
    """Converte números do CSV brasileiro (ex.: 1.234,56) em float."""
    cleaned = (value or "").strip()
    if not cleaned:
        return None
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def load_indicators() -> list[dict]:
    """Lê a tabela SIDRA local e prepara registros para a interface."""
    if not INDICATORS_FILE.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {INDICATORS_FILE}")

    records: list[dict] = []
    with INDICATORS_FILE.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file, delimiter=";")
        for row in reader:
            value = parse_number(row.get("valor", ""))
            code = (row.get("codigo_ibge") or "").strip()
            indicator = (row.get("indicador") or "").strip()
            if not code or not indicator or value is None:
                continue
            records.append(
                {
                    "codigo": code,
                    "municipio": (row.get("municipio") or "").strip(),
                    "dimensao": (row.get("dimensao") or "").strip(),
                    "indicador": indicator,
                    "ano": (row.get("ano") or "").strip(),
                    "valor": value,
                    "unidade": (row.get("unidade") or "").strip(),
                    "fonte": (row.get("fonte") or "").strip(),
                }
            )
    return records


def load_boundaries() -> dict:
    """Lê o recorte municipal em GeoJSON."""
    if not BOUNDARIES_FILE.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {BOUNDARIES_FILE}")
    with BOUNDARIES_FILE.open("r", encoding="utf-8") as geojson_file:
        return json.load(geojson_file)


class WebGISHandler(SimpleHTTPRequestHandler):
    """Entrega a interface e os endpoints locais do WebGIS."""

    server_version = "COREDE-CentroSul-WebGIS/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        route = urlsplit(self.path).path

        if route == "/api/status":
            try:
                indicators = load_indicators()
                boundaries = load_boundaries()
                municipality_count = len(boundaries.get("features", []))
                self.send_json(
                    {
                        "status": "ok",
                        "municipios": municipality_count,
                        "registros_sidra": len(indicators),
                    }
                )
            except (OSError, ValueError, csv.Error) as error:
                self.send_json({"status": "erro", "mensagem": str(error)}, 500)
            return

        if route == "/api/indicadores":
            try:
                self.send_json(
                    {
                        "fonte": "IBGE · Sistema SIDRA",
                        "registros": load_indicators(),
                    }
                )
            except (OSError, ValueError, csv.Error) as error:
                self.send_json({"erro": str(error)}, 500)
            return

        if route == "/api/municipios":
            try:
                self.send_json(load_boundaries())
            except (OSError, ValueError) as error:
                self.send_json({"erro": str(error)}, 500)
            return

        if route == "/":
            self.path = "/index.html"
        super().do_GET()


def create_server(host: str, starting_port: int, attempts: int = 20):
    """Tenta portas consecutivas para não conflitar com outro servidor local."""
    last_error: OSError | None = None
    for port in range(starting_port, starting_port + attempts):
        try:
            return ThreadingHTTPServer((host, port), WebGISHandler)
        except OSError as error:
            last_error = error
            if error.errno != errno.EADDRINUSE:
                raise
    raise OSError(
        f"Não foi possível encontrar uma porta livre entre "
        f"{starting_port} e {starting_port + attempts - 1}."
    ) from last_error


def main() -> None:
    parser = argparse.ArgumentParser(description="Executa o WebGIS localmente.")
    parser.add_argument("--host", default="127.0.0.1", help="Endereço local (padrão: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8000, help="Porta inicial (padrão: 8000).")
    args = parser.parse_args()

    server = create_server(args.host, args.port)
    address, port = server.server_address
    print(f"WebGIS disponível em http://{address}:{port}/")
    print("API: /api/status · /api/municipios · /api/indicadores")
    print("Pressione Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
    