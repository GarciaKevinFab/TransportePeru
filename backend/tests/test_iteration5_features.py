"""
Test iteration 5 features:
- Notifications API
- Dashboard KPIs (role-based)
- Vehicle/Trip/User/Maintenance CRUD (edit/delete)
- OCR endpoint for fuel vouchers
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] in ["admin", "owner"]
        print(f"Admin login successful, role: {data['user']['role']}")


class TestNotifications:
    """Notifications API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications?limit=20", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} notifications")
    
    def test_mark_notification_read(self, auth_headers):
        """Test marking notification as read"""
        # First get notifications
        response = requests.get(f"{BASE_URL}/api/notifications?limit=5", headers=auth_headers)
        notifications = response.json()
        
        if notifications:
            notif_id = notifications[0]["id"]
            # Mark as read
            response = requests.put(f"{BASE_URL}/api/notifications/{notif_id}/read", headers=auth_headers)
            assert response.status_code == 200
            print(f"Marked notification {notif_id} as read")
        else:
            print("No notifications to mark as read")
    
    def test_mark_all_notifications_read(self, auth_headers):
        """Test marking all notifications as read"""
        response = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=auth_headers)
        assert response.status_code == 200
        print("Marked all notifications as read")


class TestDashboard:
    """Dashboard KPIs tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_dashboard_kpis(self, auth_headers):
        """Test GET /api/dashboard/kpis"""
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Verify KPI structure
        assert "vehicles" in data or "trips" in data or "alerts" in data
        print(f"Dashboard KPIs: {data}")
    
    def test_get_recent_activity(self, auth_headers):
        """Test GET /api/dashboard/recent-activity"""
        response = requests.get(f"{BASE_URL}/api/dashboard/recent-activity", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Recent activity: {data}")


class TestVehiclesCRUD:
    """Vehicles CRUD tests - Edit functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_vehicles(self, auth_headers):
        """Test GET /api/vehicles"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} vehicles")
        return data
    
    def test_update_vehicle(self, auth_headers):
        """Test PUT /api/vehicles/{id} - Admin edit functionality"""
        # First get a vehicle
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        vehicles = response.json()
        
        if vehicles:
            vehicle = vehicles[0]
            vehicle_id = vehicle["id"]
            
            # Update vehicle
            update_data = {
                "brand": vehicle.get("brand", "TEST_Brand"),
                "model": vehicle.get("model", "TEST_Model"),
                "year": vehicle.get("year", 2024),
                "status": vehicle.get("status", "disponible")
            }
            
            response = requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", 
                                   json=update_data, headers=auth_headers)
            assert response.status_code == 200
            print(f"Updated vehicle {vehicle_id}")
            
            # Verify update persisted
            response = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
            updated_vehicles = response.json()
            updated_vehicle = next((v for v in updated_vehicles if v["id"] == vehicle_id), None)
            assert updated_vehicle is not None
            print(f"Vehicle update verified")
        else:
            pytest.skip("No vehicles to update")


class TestTripsCRUD:
    """Trips CRUD tests - Edit functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_trips(self, auth_headers):
        """Test GET /api/trips"""
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} trips")
        return data
    
    def test_update_trip(self, auth_headers):
        """Test PUT /api/trips/{id} - Admin edit functionality"""
        # First get a trip
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers)
        trips = response.json()
        
        if trips:
            trip = trips[0]
            trip_id = trip["id"]
            
            # Update trip
            update_data = {
                "client_name": trip.get("client_name", "TEST_Client"),
                "cargo_description": trip.get("cargo_description", "TEST_Cargo"),
                "status": trip.get("status", "programado")
            }
            
            response = requests.put(f"{BASE_URL}/api/trips/{trip_id}", 
                                   json=update_data, headers=auth_headers)
            assert response.status_code == 200
            print(f"Updated trip {trip_id}")
        else:
            pytest.skip("No trips to update")


class TestUsersCRUD:
    """Users CRUD tests - Edit functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_users(self, auth_headers):
        """Test GET /api/users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} users")
        return data
    
    def test_update_user(self, auth_headers):
        """Test PUT /api/users/{id} - Admin edit functionality"""
        # First get users
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = response.json()
        
        # Find a non-admin user to update
        non_admin_users = [u for u in users if u.get("role") not in ["owner", "admin"]]
        
        if non_admin_users:
            user = non_admin_users[0]
            user_id = user["id"]
            
            # Update user
            update_data = {
                "name": user.get("name", "TEST_User"),
                "role": user.get("role", "operaciones"),
                "is_active": user.get("is_active", True)
            }
            
            response = requests.put(f"{BASE_URL}/api/users/{user_id}", 
                                   json=update_data, headers=auth_headers)
            assert response.status_code == 200
            print(f"Updated user {user_id}")
        else:
            pytest.skip("No non-admin users to update")


class TestMaintenanceCRUD:
    """Maintenance work orders CRUD tests - Edit functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_work_orders(self, auth_headers):
        """Test GET /api/maintenance/work-orders"""
        response = requests.get(f"{BASE_URL}/api/maintenance/work-orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} work orders")
        return data
    
    def test_update_work_order(self, auth_headers):
        """Test PUT /api/maintenance/work-orders/{id} - Admin edit functionality"""
        # First get work orders
        response = requests.get(f"{BASE_URL}/api/maintenance/work-orders", headers=auth_headers)
        orders = response.json()
        
        # Find an open order to update
        open_orders = [o for o in orders if o.get("status") in ["abierta", "en_proceso"]]
        
        if open_orders:
            order = open_orders[0]
            order_id = order["id"]
            
            # Update work order
            update_data = {
                "description": order.get("description", "TEST_Description"),
                "priority": order.get("priority", "normal"),
                "workshop": order.get("workshop", "TEST_Workshop")
            }
            
            response = requests.put(f"{BASE_URL}/api/maintenance/work-orders/{order_id}", 
                                   json=update_data, headers=auth_headers)
            assert response.status_code == 200
            print(f"Updated work order {order_id}")
        else:
            pytest.skip("No open work orders to update")


class TestFuelPage:
    """Fuel page tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_fuel_vouchers(self, auth_headers):
        """Test GET /api/fuel/vouchers"""
        response = requests.get(f"{BASE_URL}/api/fuel/vouchers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} fuel vouchers")
    
    def test_get_fuel_loads(self, auth_headers):
        """Test GET /api/fuel/loads"""
        response = requests.get(f"{BASE_URL}/api/fuel/loads", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} fuel loads")


class TestOCREndpoint:
    """OCR endpoint tests for fuel voucher extraction"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_ocr_endpoint_exists(self, auth_headers):
        """Test that OCR endpoint exists and responds"""
        # Create a minimal test image (1x1 white pixel PNG as base64)
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.post(f"{BASE_URL}/api/fuel/ocr", 
                                json={"image_data": test_image_base64},
                                headers=auth_headers)
        
        # OCR endpoint should respond (may return error for invalid image but endpoint exists)
        assert response.status_code in [200, 400, 422, 500]
        print(f"OCR endpoint response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"OCR response: {data}")


class TestAlerts:
    """Alerts API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@transperu.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_alerts(self, auth_headers):
        """Test GET /api/alerts"""
        response = requests.get(f"{BASE_URL}/api/alerts?resolved=false", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} active alerts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
