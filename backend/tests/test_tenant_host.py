"""
Resolucion del inquilino por el host: la parte que no necesita base de datos.

Es el unico test unitario de la suite -los demas son de integracion contra un
backend levantado- y esta puesto aqui a proposito: `slug_desde_host` decide, en
CADA peticion, si el host manda o no. Un fallo suyo no da un error, da algo
peor:

  - de mas: `evil.sisac.pe.attacker.com` colando como el inquilino `evil`;
  - de menos: `fletepro.sisac.pe` tomado por una empresa, y la landing del
    producto sustituida por una pantalla de acceso.

Ninguna de las dos se ve en una prueba manual, porque en el navegador uno
escribe la direccion correcta.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import tenant_host  # noqa: E402


@pytest.fixture(autouse=True)
def dominio_fijo(monkeypatch):
    """El dominio sale del entorno; los tests no dependen de como este puesto."""
    monkeypatch.setattr(tenant_host, "DOMINIO_BASE", "sisac.pe")


@pytest.mark.parametrize(
    "host, esperado",
    [
        ("gye.sisac.pe", "gye"),
        ("gye.sisac.pe:443", "gye"),                # con puerto
        ("GYE.Sisac.PE", "gye"),                    # el Host no distingue mayusculas
        ("gye.sisac.pe.", "gye"),                   # raiz DNS explicita
        ("g-e-transportes.sisac.pe", "g-e-transportes"),
    ],
)
def test_subdominios_de_inquilino(host, esperado):
    assert tenant_host.slug_desde_host(host) == esperado


@pytest.mark.parametrize(
    "host, porque",
    [
        ("sisac.pe", "el dominio raiz no es de ninguna empresa"),
        ("fletepro.sisac.pe", "host de la marca: landing y acceso de rescate"),
        ("transportes.sisac.pe", "reservado (es donde opera G&E hoy)"),
        ("api.sisac.pe", "reservado para el servicio"),
        ("www.sisac.pe", "reservado"),
        ("a.b.sisac.pe", "dos niveles: el certificado comodin no lo cubre"),
        ("localhost:3000", "desarrollo"),
        ("127.0.0.1:8001", "por IP"),
        ("[::1]:8001", "IPv6"),
        ("otrodominio.com", "otro dominio"),
        # El importante: el sufijo tiene que estar al FINAL, no en medio.
        ("evil.sisac.pe.attacker.com", "sisac.pe en medio, no al final"),
        ("-malo.sisac.pe", "empieza en guion"),
        ("malo-.sisac.pe", "termina en guion"),
        ("x.sisac.pe", "una sola letra"),
        ("", "vacio"),
        (None, "ausente"),
    ],
)
def test_hosts_que_no_son_de_nadie(host, porque):
    assert tenant_host.slug_desde_host(host) is None, porque


@pytest.mark.parametrize(
    "nombre, esperado",
    [
        ("G&E Transportes S.A.C.", "g-e-transportes-s-a-c"),
        ("Logística Andina", "logistica-andina"),       # tildes
        ("Transportes Ñaña", "transportes-nana"),
        ("   ---   ", ""),                              # no queda nada utilizable
        ("日本語だけ", ""),                              # ni un caracter latino
        ("A" * 60, "a" * 30),                           # se recorta a 30
    ],
)
def test_slugificar(nombre, esperado):
    assert tenant_host.slugificar(nombre) == esperado


def test_slugificar_no_deja_guiones_en_las_puntas():
    """El recorte a 30 puede partir justo en un guion, y un nombre de dominio
    que empieza o termina en guion es invalido."""
    slug = tenant_host.slugificar("Transportes Internacionales del A Sur SAC")
    assert not slug.startswith("-") and not slug.endswith("-")
    assert tenant_host.validar_slug(slug) == slug  # no levanta


@pytest.mark.parametrize("slug", ["gye", "andina-cargo", "t2", "GYE"])
def test_validar_slug_acepta(slug):
    assert tenant_host.validar_slug(slug) == slug.lower()


@pytest.mark.parametrize(
    "slug", ["api", "www", "fletepro", "a", "-x", "x-", "x--y", "MAY USC", "", None]
)
def test_validar_slug_rechaza(slug):
    with pytest.raises(tenant_host.SlugInvalido):
        tenant_host.validar_slug(slug)


def test_el_formato_que_valida_python_es_el_que_exige_postgres():
    """La CHECK de la migracion 016 y este modulo tienen que decir lo mismo.

    Estan duplicados a proposito -la base es la ultima linea de defensa y
    Python es quien puede explicar el motivo-, y este test es lo que evita que
    la duplicacion se convierta en divergencia: si alguien afloja una de las
    dos, aqui se nota antes que en produccion.
    """
    import pathlib
    import re

    migracion = (
        pathlib.Path(__file__).resolve().parents[2]
        / "db" / "migrations" / "016_subdominio_por_empresa.sql"
    ).read_text(encoding="utf-8")

    assert tenant_host._RE_SLUG.pattern in migracion
    assert "slug !~ '--'" in migracion
    assert re.search(
        rf"length\(slug\) between {tenant_host.LARGO_MIN} and {tenant_host.LARGO_MAX}",
        migracion,
    )
