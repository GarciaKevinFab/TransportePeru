"""
Configuracion comun de la suite.

POR QUE HAY UN VALOR POR DEFECTO PARA REACT_APP_BACKEND_URL

Salvo test_tenant_host.py, todos estos tests son de integracion por HTTP contra
un backend ya levantado, y arman sus direcciones a partir de
REACT_APP_BACKEND_URL. Sin esa variable, esa parte de la direccion quedaba
vacia y lo que le llegaba a `requests` era "/api/auth/login" a secas, asi que
la suite entera moria con:

    MissingSchema: Invalid URL '/api/auth/login': No scheme supplied.

Ese mensaje no nombra la variable que falta ni dice que haya que definirla:
quien no conociera de antes esa dependencia se quedaba con decenas de errores
que parecen de red. La suite pasaba a depender de un dato no documentado.

De ahi el respaldo. 8001 es el puerto en el que corre el backend en local -es
el que usan scripts/dev-up.sh y backend/start.bat-, o sea el caso normal de
quien clona el repo y ejecuta las pruebas en su maquina. Quien apunte a otro
sitio (CI, un entorno remoto) sigue mandando con la variable de entorno.

El setdefault de aqui deja la variable puesta ANTES de que pytest importe los
modulos de test, de modo que cualquier test nuevo que use el
`os.environ.get('REACT_APP_BACKEND_URL')` de siempre tambien queda cubierto.
Cada modulo repite ademas el respaldo en su propia linea de BASE_URL, porque
todos se pueden ejecutar sueltos (`python tests/test_api.py`) sin pasar por
pytest ni por este fichero.
"""
import os

URL_BACKEND_LOCAL = "http://127.0.0.1:8001"

os.environ.setdefault("REACT_APP_BACKEND_URL", URL_BACKEND_LOCAL)
