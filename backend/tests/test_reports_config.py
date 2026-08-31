"""
Backend tests for Reports and Configuration endpoints
Tests: /api/reports/*, /api/config/*
"""
import pytest
import requests
import os

# Sin el respaldo, y con REACT_APP_BACKEND_URL sin definir, a `requests` le
# llega "/api/auth/login" a secas y la suite entera muere con "MissingSchema:
# Invalid URL: No scheme supplied" -un error que no nombra la variable que
# falta-. 8001 es el puerto del backend en local (scripts/dev-up.sh).
# El motivo largo esta en tests/conftest.py.
BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://127.0.0.1:8001').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_login_admin(self, auth_token):
        """Test admin login"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print("SUCCESS: Admin login works")


class TestReportsTrips:
    """Tests for /api/reports/trips endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_trips_report(self, auth_token):
        """Test GET /api/reports/trips"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/trips", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "trips" in data, "Response should have 'trips' key"
        assert "totals" in data, "Response should have 'totals' key"
        assert isinstance(data["trips"], list), "trips should be a list"
        
        # Validate totals structure
        totals = data["totals"]
        assert "count" in totals, "totals should have 'count'"
        assert "total_km" in totals, "totals should have 'total_km'"
        assert "total_advances" in totals, "totals should have 'total_advances'"
        assert "total_expenses" in totals, "totals should have 'total_expenses'"
        assert "balance" in totals, "totals should have 'balance'"
        
        print(f"SUCCESS: Trips report returned {totals['count']} trips")
    
    def test_get_trips_report_with_date_filter(self, auth_token):
        """Test GET /api/reports/trips with date filters"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/reports/trips?start_date=2025-01-01&end_date=2026-12-31",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "trips" in data
        print(f"SUCCESS: Trips report with date filter returned {data['totals']['count']} trips")


class TestReportsExportExcel:
    """Tests for /api/reports/trips/export/excel endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_export_trips_excel(self, auth_token):
        """Test GET /api/reports/trips/export/excel"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/trips/export/excel", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Validate content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "application/octet-stream" in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Validate content disposition
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp, "Should have attachment disposition"
        assert ".xlsx" in content_disp, "Should have .xlsx extension"
        
        # Validate content is not empty
        assert len(response.content) > 0, "Excel file should not be empty"
        
        print(f"SUCCESS: Excel export returned {len(response.content)} bytes")


class TestReportsSettlementPDF:
    """Tests for /api/reports/settlements/export/pdf/{trip_id} endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trip_id(self, auth_token):
        """Get a trip ID for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/trips", headers=headers)
        if response.status_code == 200 and response.json():
            return response.json()[0]["id"]
        return None
    
    def test_export_settlement_pdf(self, auth_token, trip_id):
        """Test GET /api/reports/settlements/export/pdf/{trip_id}"""
        if not trip_id:
            pytest.skip("No trips available for testing")
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/reports/settlements/export/pdf/{trip_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Validate content type
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type or "application/octet-stream" in content_type, \
            f"Expected PDF content type, got: {content_type}"
        
        # Validate content is not empty
        assert len(response.content) > 0, "PDF file should not be empty"
        
        print(f"SUCCESS: PDF export returned {len(response.content)} bytes")
    
    def test_export_settlement_pdf_invalid_trip(self, auth_token):
        """Test PDF export with invalid trip ID"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/reports/settlements/export/pdf/invalid-trip-id",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("SUCCESS: Invalid trip ID returns 404")


class TestReportsFuel:
    """Tests for /api/reports/fuel endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_fuel_report(self, auth_token):
        """Test GET /api/reports/fuel"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/fuel", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "loads" in data, "Response should have 'loads' key"
        assert "totals" in data, "Response should have 'totals' key"
        
        # Validate totals structure
        totals = data["totals"]
        assert "total_loads" in totals
        assert "total_liters" in totals
        assert "total_amount" in totals
        assert "avg_price_per_liter" in totals
        
        print(f"SUCCESS: Fuel report returned {totals['total_loads']} loads")


class TestReportsMaintenance:
    """Tests for /api/reports/maintenance endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_maintenance_report(self, auth_token):
        """Test GET /api/reports/maintenance"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/maintenance", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "work_orders" in data, "Response should have 'work_orders' key"
        assert "totals" in data, "Response should have 'totals' key"
        assert "by_status" in data, "Response should have 'by_status' key"
        
        print(f"SUCCESS: Maintenance report returned {data['totals']['count']} work orders")


class TestConfigCompany:
    """Tests for /api/config/company endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_company_config(self, auth_token):
        """Test GET /api/config/company"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/config/company", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate company data structure
        assert "id" in data, "Company should have 'id'"
        assert "name" in data, "Company should have 'name'"
        
        print(f"SUCCESS: Company config returned: {data.get('name', 'N/A')}")
    
    def test_update_company_config(self, auth_token):
        """Test PUT /api/config/company"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get current config
        get_response = requests.get(f"{BASE_URL}/api/config/company", headers=headers)
        original_data = get_response.json()
        
        # Update with test data
        update_data = {
            "name": original_data.get("name", "TransportePeru"),
            "phone": "999888777",
            "config": {
                "require_checklist_for_start": True,
                "block_trip_on_critical_checklist": True
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/config/company",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/config/company", headers=headers)
        updated_data = verify_response.json()
        assert updated_data.get("phone") == "999888777", "Phone should be updated"
        
        print("SUCCESS: Company config updated and verified")


class TestConfigDocumentTypes:
    """Tests for /api/config/document-types endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_document_types(self, auth_token):
        """Test GET /api/config/document-types"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/config/document-types", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Document types returned {len(data)} types")
    
    def test_create_document_type(self, auth_token):
        """Test POST /api/config/document-types"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        new_doc_type = {
            "name": "TEST_Documento_Prueba",
            "applies_to": "vehiculo",
            "is_critical": False,
            "requires_expiry": True,
            "block_rule": "solo_alerta"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/config/document-types",
            headers=headers,
            json=new_doc_type
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should have 'id'"
        
        print(f"SUCCESS: Document type created with ID: {data['id']}")
        return data["id"]
    
    def test_update_document_type(self, auth_token):
        """Test PUT /api/config/document-types/{id}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a document type
        new_doc_type = {
            "name": "TEST_Update_DocType",
            "applies_to": "vehiculo",
            "is_critical": False,
            "requires_expiry": True,
            "block_rule": "solo_alerta"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/config/document-types",
            headers=headers,
            json=new_doc_type
        )
        doc_type_id = create_response.json()["id"]
        
        # Update it
        update_data = {
            "name": "TEST_Updated_DocType",
            "is_critical": True,
            "block_rule": "bloquea_asignacion"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/config/document-types/{doc_type_id}",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print("SUCCESS: Document type updated")
    
    def test_delete_document_type(self, auth_token):
        """Test DELETE /api/config/document-types/{id}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a document type to delete
        new_doc_type = {
            "name": "TEST_Delete_DocType",
            "applies_to": "vehiculo",
            "is_critical": False,
            "requires_expiry": True,
            "block_rule": "solo_alerta"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/config/document-types",
            headers=headers,
            json=new_doc_type
        )
        doc_type_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/config/document-types/{doc_type_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print("SUCCESS: Document type deleted")


class TestConfigChecklistTemplates:
    """Tests for /api/config/checklist-templates endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_checklist_templates(self, auth_token):
        """Test GET /api/config/checklist-templates"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/config/checklist-templates", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Checklist templates returned {len(data)} templates")
    
    def test_create_checklist_template(self, auth_token):
        """Test POST /api/config/checklist-templates"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        new_template = {
            "name": "TEST_Checklist_Template",
            "vehicle_type": "tracto",
            "items": [
                {
                    "category": "Motor",
                    "item": "Nivel de aceite",
                    "is_critical": True,
                    "requires_photo": False
                },
                {
                    "category": "Frenos",
                    "item": "Estado de pastillas",
                    "is_critical": True,
                    "requires_photo": True
                }
            ],
            "is_active": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/config/checklist-templates",
            headers=headers,
            json=new_template
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should have 'id'"
        
        print(f"SUCCESS: Checklist template created with ID: {data['id']}")
    
    def test_update_checklist_template(self, auth_token):
        """Test PUT /api/config/checklist-templates/{id}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a template
        new_template = {
            "name": "TEST_Update_Template",
            "vehicle_type": "tracto",
            "items": [],
            "is_active": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/config/checklist-templates",
            headers=headers,
            json=new_template
        )
        template_id = create_response.json()["id"]
        
        # Update it
        update_data = {
            "name": "TEST_Updated_Template",
            "is_active": False,
            "items": [
                {"category": "Test", "item": "Test Item", "is_critical": False}
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/config/checklist-templates/{template_id}",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print("SUCCESS: Checklist template updated")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_cleanup_test_document_types(self, auth_token):
        """Clean up TEST_ prefixed document types"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get all document types
        response = requests.get(f"{BASE_URL}/api/config/document-types", headers=headers)
        doc_types = response.json()
        
        # Delete TEST_ prefixed ones
        deleted = 0
        for dt in doc_types:
            if dt.get("name", "").startswith("TEST_"):
                del_response = requests.delete(
                    f"{BASE_URL}/api/config/document-types/{dt['id']}",
                    headers=headers
                )
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"SUCCESS: Cleaned up {deleted} test document types")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
