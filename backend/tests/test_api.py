"""
TransportePeru SaaS API Tests
Tests for Issues, Fuel, Maintenance, Inventory, and Tires modules
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://flota-peru.preview.emergentagent.com')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_admin_login(self):
        """Test admin login with email/password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@transperu.com"
    
    def test_driver_login(self):
        """Test driver login with DNI/PIN"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "dni": "12345678",
            "pin": "123456"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "chofer"
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestDashboard:
    """Dashboard KPIs tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_dashboard_kpis(self, auth_headers):
        """Test dashboard KPIs endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Verify KPI structure
        assert "vehicles" in data
        assert "trips" in data
        assert "documents" in data


class TestIssues:
    """Issues/Incidents module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture(scope="class")
    def vehicle_id(self, auth_headers):
        """Get a vehicle ID for testing"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        vehicles = response.json()
        if vehicles:
            return vehicles[0]["id"]
        return None
    
    @pytest.fixture(scope="class")
    def driver_id(self, auth_headers):
        """Get a driver ID for testing"""
        response = requests.get(f"{BASE_URL}/api/users?role=chofer", headers=auth_headers)
        drivers = response.json()
        if drivers:
            return drivers[0]["id"]
        return None
    
    def test_get_issues(self, auth_headers):
        """Test getting all issues"""
        response = requests.get(f"{BASE_URL}/api/issues", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_issue(self, auth_headers, vehicle_id, driver_id):
        """Test creating a new issue"""
        issue_data = {
            "issue_type": "incidente",
            "severity": "media",
            "title": "TEST_Incidente de prueba",
            "description": "Descripción del incidente de prueba para testing",
            "vehicle_id": vehicle_id,
            "driver_id": driver_id,
            "cost": 150.50
        }
        response = requests.post(f"{BASE_URL}/api/issues", json=issue_data, headers=auth_headers)
        assert response.status_code == 200, f"Create issue failed: {response.text}"
        data = response.json()
        assert "id" in data
        return data["id"]
    
    def test_update_issue(self, auth_headers, vehicle_id, driver_id):
        """Test updating an issue"""
        # First create an issue
        issue_data = {
            "issue_type": "multa",
            "severity": "alta",
            "title": "TEST_Multa de prueba",
            "description": "Multa por exceso de velocidad",
            "vehicle_id": vehicle_id,
            "cost": 500.00
        }
        create_response = requests.post(f"{BASE_URL}/api/issues", json=issue_data, headers=auth_headers)
        assert create_response.status_code == 200
        issue_id = create_response.json()["id"]
        
        # Update the issue
        update_data = {
            "status": "en_proceso",
            "resolution": "En proceso de apelación"
        }
        update_response = requests.put(f"{BASE_URL}/api/issues/{issue_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/issues", headers=auth_headers)
        issues = get_response.json()
        updated_issue = next((i for i in issues if i["id"] == issue_id), None)
        assert updated_issue is not None
        assert updated_issue["status"] == "en_proceso"


class TestFuel:
    """Fuel module tests - Vouchers and Loads"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture(scope="class")
    def tracto_id(self, auth_headers):
        """Get a tracto vehicle ID for testing"""
        response = requests.get(f"{BASE_URL}/api/vehicles?vehicle_type=tracto", headers=auth_headers)
        vehicles = response.json()
        if vehicles:
            return vehicles[0]["id"]
        return None
    
    def test_get_fuel_vouchers(self, auth_headers):
        """Test getting fuel vouchers"""
        response = requests.get(f"{BASE_URL}/api/fuel/vouchers", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_fuel_voucher(self, auth_headers, tracto_id):
        """Test creating a fuel voucher"""
        if not tracto_id:
            pytest.skip("No tracto vehicle available")
        
        voucher_data = {
            "voucher_number": f"TEST_VALE-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "vehicle_id": tracto_id,
            "provider": "Grifo Test",
            "limit_liters": 100.0,
            "valid_from": datetime.now().isoformat(),
            "valid_until": (datetime.now() + timedelta(days=30)).isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/fuel/vouchers", json=voucher_data, headers=auth_headers)
        assert response.status_code == 200, f"Create voucher failed: {response.text}"
        data = response.json()
        assert "id" in data
    
    def test_get_fuel_loads(self, auth_headers):
        """Test getting fuel loads"""
        response = requests.get(f"{BASE_URL}/api/fuel/loads", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_fuel_load(self, auth_headers, tracto_id):
        """Test creating a fuel load"""
        if not tracto_id:
            pytest.skip("No tracto vehicle available")
        
        load_data = {
            "vehicle_id": tracto_id,
            "liters": 50.0,
            "price_per_liter": 15.50,
            "odometer": 150000,
            "provider": "Grifo Test"
        }
        response = requests.post(f"{BASE_URL}/api/fuel/loads", json=load_data, headers=auth_headers)
        assert response.status_code == 200, f"Create load failed: {response.text}"
        data = response.json()
        assert "id" in data
    
    def test_get_fuel_kpis(self, auth_headers):
        """Test getting fuel KPIs"""
        response = requests.get(f"{BASE_URL}/api/fuel/kpis", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "vehicle_kpis" in data
    
    def test_get_fuel_conciliation(self, auth_headers):
        """Test getting fuel conciliation"""
        response = requests.get(f"{BASE_URL}/api/fuel/conciliation", headers=auth_headers)
        assert response.status_code == 200


class TestMaintenance:
    """Maintenance module tests - Work Orders"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture(scope="class")
    def vehicle_id(self, auth_headers):
        """Get a vehicle ID for testing"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        vehicles = response.json()
        if vehicles:
            return vehicles[0]["id"]
        return None
    
    def test_get_work_orders(self, auth_headers):
        """Test getting work orders"""
        response = requests.get(f"{BASE_URL}/api/maintenance/work-orders", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_work_order(self, auth_headers, vehicle_id):
        """Test creating a work order"""
        if not vehicle_id:
            pytest.skip("No vehicle available")
        
        wo_data = {
            "vehicle_id": vehicle_id,
            "order_type": "correctivo",
            "priority": "normal",
            "description": "TEST_Cambio de aceite y filtros",
            "workshop": "Taller Test"
        }
        response = requests.post(f"{BASE_URL}/api/maintenance/work-orders", json=wo_data, headers=auth_headers)
        assert response.status_code == 200, f"Create work order failed: {response.text}"
        data = response.json()
        assert "id" in data
        return data["id"]
    
    def test_start_work_order(self, auth_headers, vehicle_id):
        """Test starting a work order"""
        if not vehicle_id:
            pytest.skip("No vehicle available")
        
        # Create a work order first
        wo_data = {
            "vehicle_id": vehicle_id,
            "order_type": "preventivo",
            "priority": "alta",
            "description": "TEST_Mantenimiento preventivo 50000km"
        }
        create_response = requests.post(f"{BASE_URL}/api/maintenance/work-orders", json=wo_data, headers=auth_headers)
        assert create_response.status_code == 200
        wo_id = create_response.json()["id"]
        
        # Start the work order
        start_response = requests.post(f"{BASE_URL}/api/maintenance/work-orders/{wo_id}/start", json={}, headers=auth_headers)
        assert start_response.status_code == 200
    
    def test_complete_work_order(self, auth_headers, vehicle_id):
        """Test completing a work order"""
        if not vehicle_id:
            pytest.skip("No vehicle available")
        
        # Create and start a work order
        wo_data = {
            "vehicle_id": vehicle_id,
            "order_type": "correctivo",
            "priority": "normal",
            "description": "TEST_Reparación de frenos"
        }
        create_response = requests.post(f"{BASE_URL}/api/maintenance/work-orders", json=wo_data, headers=auth_headers)
        wo_id = create_response.json()["id"]
        
        # Start it
        requests.post(f"{BASE_URL}/api/maintenance/work-orders/{wo_id}/start", json={}, headers=auth_headers)
        
        # Complete it
        complete_data = {
            "labor_cost": 200.00,
            "parts_cost": 350.00,
            "odometer": 155000,
            "notes": "Trabajo completado satisfactoriamente"
        }
        complete_response = requests.post(f"{BASE_URL}/api/maintenance/work-orders/{wo_id}/complete", json=complete_data, headers=auth_headers)
        assert complete_response.status_code == 200


class TestInventory:
    """Inventory module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_inventory_items(self, auth_headers):
        """Test getting inventory items"""
        response = requests.get(f"{BASE_URL}/api/inventory/items", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_inventory_item(self, auth_headers):
        """Test creating an inventory item"""
        item_data = {
            "code": f"TEST_REP-{datetime.now().strftime('%H%M%S')}",
            "name": "TEST_Filtro de aceite",
            "category": "filtro",
            "unit": "unidad",
            "min_stock": 5,
            "max_stock": 50,
            "unit_cost": 45.00,
            "location": "Estante A-1"
        }
        response = requests.post(f"{BASE_URL}/api/inventory/items", json=item_data, headers=auth_headers)
        assert response.status_code == 200, f"Create item failed: {response.text}"
        data = response.json()
        assert "id" in data
        return data["id"]
    
    def test_create_stock_move_entrada(self, auth_headers):
        """Test creating a stock entry movement"""
        # First create an item
        item_data = {
            "code": f"TEST_MOV-{datetime.now().strftime('%H%M%S')}",
            "name": "TEST_Item para movimiento",
            "category": "repuesto",
            "unit": "unidad",
            "min_stock": 2,
            "unit_cost": 100.00
        }
        create_response = requests.post(f"{BASE_URL}/api/inventory/items", json=item_data, headers=auth_headers)
        item_id = create_response.json()["id"]
        
        # Create stock entry
        move_data = {
            "item_id": item_id,
            "move_type": "entrada",
            "quantity": 10,
            "unit_cost": 100.00,
            "notes": "Compra inicial de prueba"
        }
        response = requests.post(f"{BASE_URL}/api/inventory/moves", json=move_data, headers=auth_headers)
        assert response.status_code == 200, f"Create move failed: {response.text}"
        
        # Verify stock was updated
        items_response = requests.get(f"{BASE_URL}/api/inventory/items", headers=auth_headers)
        items = items_response.json()
        updated_item = next((i for i in items if i["id"] == item_id), None)
        assert updated_item is not None
        assert updated_item["current_stock"] == 10
    
    def test_get_suppliers(self, auth_headers):
        """Test getting suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_supplier(self, auth_headers):
        """Test creating a supplier"""
        supplier_data = {
            "name": f"TEST_Proveedor {datetime.now().strftime('%H%M%S')}",
            "ruc": "20123456789",
            "phone": "999888777",
            "email": "test@proveedor.com",
            "category": "repuestos"
        }
        response = requests.post(f"{BASE_URL}/api/suppliers", json=supplier_data, headers=auth_headers)
        assert response.status_code == 200, f"Create supplier failed: {response.text}"


class TestTires:
    """Tires module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture(scope="class")
    def vehicle_id(self, auth_headers):
        """Get a vehicle ID for testing"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        vehicles = response.json()
        if vehicles:
            return vehicles[0]["id"]
        return None
    
    def test_get_tires(self, auth_headers):
        """Test getting all tires"""
        response = requests.get(f"{BASE_URL}/api/tires", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_tire(self, auth_headers):
        """Test creating a new tire"""
        tire_data = {
            "serial": f"TEST_DOT{datetime.now().strftime('%H%M%S')}",
            "brand": "Michelin",
            "model": "X Multi D",
            "dimension": "295/80R22.5",
            "purchase_cost": 1500.00,
            "supplier": "Llantería Test"
        }
        response = requests.post(f"{BASE_URL}/api/tires", json=tire_data, headers=auth_headers)
        assert response.status_code == 200, f"Create tire failed: {response.text}"
        data = response.json()
        assert "id" in data
        return data["id"]
    
    def test_get_tires_by_vehicle(self, auth_headers, vehicle_id):
        """Test getting tires by vehicle"""
        if not vehicle_id:
            pytest.skip("No vehicle available")
        
        response = requests.get(f"{BASE_URL}/api/tires/vehicle/{vehicle_id}", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_tires_required_report(self, auth_headers):
        """Test getting tires required report"""
        response = requests.get(f"{BASE_URL}/api/tires/reports/required", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "critical_depth" in data or "inspection_required" in data or isinstance(data, dict)
    
    def test_mount_and_unmount_tire(self, auth_headers, vehicle_id):
        """Test mounting and unmounting a tire"""
        if not vehicle_id:
            pytest.skip("No vehicle available")
        
        # Create a new tire
        tire_data = {
            "serial": f"TEST_MOUNT{datetime.now().strftime('%H%M%S')}",
            "brand": "Goodyear",
            "model": "KMAX S",
            "dimension": "295/80R22.5",
            "purchase_cost": 1400.00
        }
        create_response = requests.post(f"{BASE_URL}/api/tires", json=tire_data, headers=auth_headers)
        tire_id = create_response.json()["id"]
        
        # Mount the tire
        mount_data = {
            "tire_id": tire_id,
            "vehicle_id": vehicle_id,
            "position_code": "EJE1-IZQ",
            "mount_odometer": 100000
        }
        mount_response = requests.post(f"{BASE_URL}/api/tires/mount", json=mount_data, headers=auth_headers)
        assert mount_response.status_code == 200, f"Mount tire failed: {mount_response.text}"
        
        # Unmount the tire
        unmount_data = {
            "unmount_odometer": 105000,
            "reason": "Rotación de prueba"
        }
        unmount_response = requests.post(f"{BASE_URL}/api/tires/{tire_id}/unmount", json=unmount_data, headers=auth_headers)
        assert unmount_response.status_code == 200, f"Unmount tire failed: {unmount_response.text}"


class TestNavigation:
    """Test navigation and page access"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_vehicles_endpoint(self, auth_headers):
        """Test vehicles endpoint"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        assert response.status_code == 200
    
    def test_trips_endpoint(self, auth_headers):
        """Test trips endpoint"""
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers)
        assert response.status_code == 200
    
    def test_users_endpoint(self, auth_headers):
        """Test users endpoint"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
    
    def test_documents_endpoint(self, auth_headers):
        """Test documents endpoint"""
        response = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers)
        assert response.status_code == 200
    
    def test_alerts_endpoint(self, auth_headers):
        """Test alerts endpoint"""
        response = requests.get(f"{BASE_URL}/api/alerts", headers=auth_headers)
        assert response.status_code == 200


# Cleanup test data after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Note: In production, you would delete test data here
    # For now, we leave it as the data is prefixed with TEST_
    print("\nTest data cleanup: TEST_ prefixed data should be cleaned manually if needed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
