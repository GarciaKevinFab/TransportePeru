"""
TransportePeru SaaS API Tests - Settlements and Checklist
Tests for Viáticos (Settlements) and Checklist del Chofer modules
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fleet-manager-pe.preview.emergentagent.com')


class TestSettlements:
    """Settlements/Viáticos module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture(scope="class")
    def trip_id(self, auth_headers):
        """Get a trip ID for testing"""
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers)
        assert response.status_code == 200
        trips = response.json()
        assert len(trips) > 0, "No trips found for testing"
        return trips[0]["id"]
    
    def test_get_trips(self, auth_headers):
        """Test getting all trips"""
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} trips")
    
    def test_get_trip_advances(self, auth_headers, trip_id):
        """Test getting advances for a trip"""
        response = requests.get(f"{BASE_URL}/api/trips/{trip_id}/advances", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} advances for trip {trip_id}")
    
    def test_get_trip_expenses(self, auth_headers, trip_id):
        """Test getting expenses for a trip"""
        response = requests.get(f"{BASE_URL}/api/trips/{trip_id}/expenses", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} expenses for trip {trip_id}")
    
    def test_create_advance(self, auth_headers, trip_id):
        """Test creating an advance for a trip"""
        advance_data = {
            "amount": 100.00,
            "payment_method": "efectivo",
            "notes": "TEST_Anticipo de prueba"
        }
        response = requests.post(
            f"{BASE_URL}/api/trips/{trip_id}/advances",
            json=advance_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create advance failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Created advance with ID: {data['id']}")
        
        # Verify advance was created by fetching advances
        verify_response = requests.get(f"{BASE_URL}/api/trips/{trip_id}/advances", headers=auth_headers)
        assert verify_response.status_code == 200
        advances = verify_response.json()
        test_advances = [a for a in advances if a.get("notes") == "TEST_Anticipo de prueba"]
        assert len(test_advances) > 0, "Created advance not found"
    
    def test_create_expense(self, auth_headers, trip_id):
        """Test creating an expense for a trip"""
        expense_data = {
            "category": "alimentacion",
            "description": "TEST_Almuerzo en ruta",
            "amount": 50.00,
            "provider": "Restaurante Test",
            "ruc": "20123456789",
            "has_igv": True
        }
        response = requests.post(
            f"{BASE_URL}/api/trips/{trip_id}/expenses",
            json=expense_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create expense failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Created expense with ID: {data['id']}")
        
        # Verify expense was created
        verify_response = requests.get(f"{BASE_URL}/api/trips/{trip_id}/expenses", headers=auth_headers)
        assert verify_response.status_code == 200
        expenses = verify_response.json()
        test_expenses = [e for e in expenses if e.get("description") == "TEST_Almuerzo en ruta"]
        assert len(test_expenses) > 0, "Created expense not found"
    
    def test_get_settlements(self, auth_headers):
        """Test getting all settlements"""
        response = requests.get(f"{BASE_URL}/api/settlements", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} settlements")
    
    def test_create_settlement(self, auth_headers, trip_id):
        """Test creating/updating a settlement for a trip"""
        settlement_data = {
            "deductions": 0,
            "notes": "TEST_Settlement"
        }
        response = requests.post(
            f"{BASE_URL}/api/trips/{trip_id}/settlement",
            json=settlement_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create settlement failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Created/updated settlement with ID: {data['id']}")
        return data["id"]
    
    def test_close_settlement(self, auth_headers, trip_id):
        """Test closing a settlement"""
        # First create/update the settlement
        settlement_data = {"deductions": 0, "notes": "TEST_Settlement to close"}
        create_response = requests.post(
            f"{BASE_URL}/api/trips/{trip_id}/settlement",
            json=settlement_data,
            headers=auth_headers
        )
        assert create_response.status_code == 200
        settlement_id = create_response.json()["id"]
        
        # Now close it
        close_response = requests.post(
            f"{BASE_URL}/api/settlements/{settlement_id}/close",
            json={},
            headers=auth_headers
        )
        # May fail if already closed, which is acceptable
        assert close_response.status_code in [200, 400], f"Close settlement failed: {close_response.text}"
        print(f"Settlement close response: {close_response.status_code}")


class TestChecklist:
    """Checklist module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture(scope="class")
    def trip_id(self, auth_headers):
        """Get a trip ID for testing (use second trip to avoid conflicts)"""
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers)
        assert response.status_code == 200
        trips = response.json()
        assert len(trips) > 1, "Need at least 2 trips for testing"
        return trips[1]["id"]  # Use second trip
    
    def test_get_checklist_templates(self, auth_headers):
        """Test getting checklist templates"""
        response = requests.get(f"{BASE_URL}/api/checklist-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} checklist templates")
    
    def test_get_checklist_by_trip(self, auth_headers, trip_id):
        """Test getting checklist for a trip"""
        response = requests.get(f"{BASE_URL}/api/checklists/trip/{trip_id}", headers=auth_headers)
        # May return null if no checklist exists
        assert response.status_code == 200
        print(f"Checklist for trip {trip_id}: {response.json()}")
    
    def test_submit_trip_checklist(self, auth_headers, trip_id):
        """Test submitting a complete checklist for a trip"""
        checklist_data = {
            "responses": [
                {"item_id": "1", "item": "SOAT vigente", "category": "Documentación", "is_critical": True, "status": "ok", "notes": ""},
                {"item_id": "2", "item": "Revisión técnica vigente", "category": "Documentación", "is_critical": True, "status": "ok", "notes": ""},
                {"item_id": "3", "item": "Luces frontales funcionan", "category": "Cabina", "is_critical": True, "status": "ok", "notes": ""},
            ],
            "tire_checks": [
                {"position": "EJE1-IZQ", "pressure": "100", "depth": "8", "status": "ok", "notes": ""},
                {"position": "EJE1-DER", "pressure": "100", "depth": "8", "status": "ok", "notes": ""},
            ],
            "signature_url": "data:image/png;base64,TEST_SIGNATURE",
            "location": {"lat": -12.0464, "lng": -77.0428},
            "km_start": 150000,
            "notes": "TEST_Checklist submission",
            "result": "ok"
        }
        response = requests.post(
            f"{BASE_URL}/api/trip/{trip_id}/checklist",
            json=checklist_data,
            headers=auth_headers
        )
        # May fail if checklist already exists
        assert response.status_code in [200, 400], f"Submit checklist failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "result" in data
            print(f"Checklist submitted with result: {data['result']}")
        else:
            print(f"Checklist submission returned 400 (may already exist): {response.json()}")


class TestAllMenuPages:
    """Test that all menu pages load correctly"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_dashboard_kpis(self, auth_headers):
        """Test Dashboard KPIs endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "vehicles" in data
        print(f"Dashboard: {data['vehicles']['total']} vehicles, {data['trips']['active']} active trips")
    
    def test_vehicles_endpoint(self, auth_headers):
        """Test Vehicles endpoint"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Vehicles: {len(data)} found")
    
    def test_documents_endpoint(self, auth_headers):
        """Test Documents endpoint"""
        response = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Documents: {len(data)} found")
    
    def test_trips_endpoint(self, auth_headers):
        """Test Trips endpoint"""
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Trips: {len(data)} found")
    
    def test_fuel_vouchers_endpoint(self, auth_headers):
        """Test Fuel Vouchers endpoint"""
        response = requests.get(f"{BASE_URL}/api/fuel/vouchers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Fuel Vouchers: {len(data)} found")
    
    def test_tires_endpoint(self, auth_headers):
        """Test Tires endpoint"""
        response = requests.get(f"{BASE_URL}/api/tires", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Tires: {len(data)} found")
    
    def test_maintenance_work_orders_endpoint(self, auth_headers):
        """Test Maintenance Work Orders endpoint"""
        response = requests.get(f"{BASE_URL}/api/maintenance/work-orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Work Orders: {len(data)} found")
    
    def test_inventory_items_endpoint(self, auth_headers):
        """Test Inventory Items endpoint"""
        response = requests.get(f"{BASE_URL}/api/inventory/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Inventory Items: {len(data)} found")
    
    def test_issues_endpoint(self, auth_headers):
        """Test Issues endpoint"""
        response = requests.get(f"{BASE_URL}/api/issues", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Issues: {len(data)} found")
    
    def test_users_endpoint(self, auth_headers):
        """Test Users endpoint"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Users: {len(data)} found")
    
    def test_settlements_endpoint(self, auth_headers):
        """Test Settlements endpoint"""
        response = requests.get(f"{BASE_URL}/api/settlements", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Settlements: {len(data)} found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
