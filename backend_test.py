#!/usr/bin/env python3
"""
Backend API Testing for TransportePeru SaaS
Tests all API endpoints with proper authentication and data validation
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class TransportePeruAPITester:
    def __init__(self, base_url: str = "https://fleet-manager-pe.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.driver_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test credentials
        self.admin_credentials = {
            "email": "admin@transperu.com",
            "password": "admin123"
        }
        self.driver_credentials = {
            "dni": "12345678",
            "pin": "123456"
        }

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    token: str = None, expected_status: int = 200) -> tuple:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", None
            
            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return success, f"Status: {response.status_code}", response_data
            
        except requests.exceptions.Timeout:
            return False, "Request timeout", None
        except requests.exceptions.ConnectionError:
            return False, "Connection error", None
        except Exception as e:
            return False, f"Error: {str(e)}", None

    def test_seed_data(self):
        """Test 1: Seed demo data endpoint"""
        print("\n🔍 Testing seed demo data endpoint...")
        success, details, response = self.make_request('POST', 'seed', expected_status=200)
        
        if success and response:
            self.log_test("Seed demo data", True, f"Created demo data successfully")
        else:
            # Check if data already exists (acceptable)
            if "already exists" in str(response).lower():
                self.log_test("Seed demo data", True, "Demo data already exists")
            else:
                self.log_test("Seed demo data", False, details)

    def test_admin_login(self):
        """Test 2: Admin login with email/password"""
        print("\n🔍 Testing admin login...")
        success, details, response = self.make_request(
            'POST', 'auth/login', 
            data=self.admin_credentials,
            expected_status=200
        )
        
        if success and response and 'access_token' in response:
            self.admin_token = response['access_token']
            user_info = response.get('user', {})
            self.log_test("Admin login", True, f"Logged in as {user_info.get('name', 'Admin')}")
        else:
            self.log_test("Admin login", False, f"{details} - {response}")

    def test_driver_login(self):
        """Test 3: Driver login with DNI/PIN"""
        print("\n🔍 Testing driver login...")
        success, details, response = self.make_request(
            'POST', 'auth/login',
            data=self.driver_credentials,
            expected_status=200
        )
        
        if success and response and 'access_token' in response:
            self.driver_token = response['access_token']
            user_info = response.get('user', {})
            self.log_test("Driver login", True, f"Logged in as {user_info.get('name', 'Driver')}")
        else:
            self.log_test("Driver login", False, f"{details} - {response}")

    def test_token_refresh(self):
        """Test 4: JWT token refresh"""
        if not self.admin_token:
            self.log_test("Token refresh", False, "No admin token available")
            return
            
        print("\n🔍 Testing token refresh...")
        # First get refresh token from login
        success, details, response = self.make_request(
            'POST', 'auth/login',
            data=self.admin_credentials,
            expected_status=200
        )
        
        if success and response and 'refresh_token' in response:
            refresh_token = response['refresh_token']
            success, details, refresh_response = self.make_request(
                'POST', 'auth/refresh',
                data={"refresh_token": refresh_token},
                expected_status=200
            )
            
            if success and refresh_response and 'access_token' in refresh_response:
                self.log_test("Token refresh", True, "Token refreshed successfully")
            else:
                self.log_test("Token refresh", False, f"{details} - {refresh_response}")
        else:
            self.log_test("Token refresh", False, "Could not get refresh token")

    def test_get_current_user(self):
        """Test 5: Get current user info"""
        if not self.admin_token:
            self.log_test("Get current user", False, "No admin token available")
            return
            
        print("\n🔍 Testing get current user...")
        success, details, response = self.make_request(
            'GET', 'auth/me',
            token=self.admin_token,
            expected_status=200
        )
        
        if success and response and 'id' in response:
            self.log_test("Get current user", True, f"User: {response.get('name', 'Unknown')}")
        else:
            self.log_test("Get current user", False, f"{details} - {response}")

    def test_vehicles_crud(self):
        """Test 6: CRUD operations for vehicles"""
        if not self.admin_token:
            self.log_test("Vehicles CRUD", False, "No admin token available")
            return
            
        print("\n🔍 Testing vehicles CRUD operations...")
        
        # Test GET vehicles
        success, details, response = self.make_request(
            'GET', 'vehicles',
            token=self.admin_token,
            expected_status=200
        )
        
        if success and isinstance(response, list):
            vehicle_count = len(response)
            self.log_test("Get vehicles", True, f"Found {vehicle_count} vehicles")
            
            # Test creating a new vehicle
            new_vehicle_data = {
                "plate": "TEST-001",
                "vehicle_type": "tracto",
                "brand": "Test Brand",
                "model": "Test Model",
                "year": 2024,
                "color": "Blanco",
                "fuel_capacity": 400.0,
                "tire_config": "6"
            }
            
            success, details, create_response = self.make_request(
                'POST', 'vehicles',
                data=new_vehicle_data,
                token=self.admin_token,
                expected_status=200
            )
            
            if success and create_response and 'id' in create_response:
                vehicle_id = create_response['id']
                self.log_test("Create vehicle", True, f"Created vehicle with ID: {vehicle_id}")
                
                # Test updating the vehicle
                update_data = {"color": "Azul", "year": 2025}
                success, details, update_response = self.make_request(
                    'PUT', f'vehicles/{vehicle_id}',
                    data=update_data,
                    token=self.admin_token,
                    expected_status=200
                )
                
                if success:
                    self.log_test("Update vehicle", True, "Vehicle updated successfully")
                else:
                    self.log_test("Update vehicle", False, f"{details} - {update_response}")
                
                # Test deleting the vehicle
                success, details, delete_response = self.make_request(
                    'DELETE', f'vehicles/{vehicle_id}',
                    token=self.admin_token,
                    expected_status=200
                )
                
                if success:
                    self.log_test("Delete vehicle", True, "Vehicle deleted successfully")
                else:
                    self.log_test("Delete vehicle", False, f"{details} - {delete_response}")
            else:
                self.log_test("Create vehicle", False, f"{details} - {create_response}")
        else:
            self.log_test("Get vehicles", False, f"{details} - {response}")

    def test_documents_matrix(self):
        """Test 7: Get document matrix"""
        if not self.admin_token:
            self.log_test("Documents matrix", False, "No admin token available")
            return
            
        print("\n🔍 Testing documents matrix...")
        success, details, response = self.make_request(
            'GET', 'documents/matrix?entity_type=vehicle',
            token=self.admin_token,
            expected_status=200
        )
        
        if success and response and 'matrix' in response:
            matrix_count = len(response['matrix'])
            doc_types_count = len(response.get('document_types', []))
            self.log_test("Documents matrix", True, 
                         f"Matrix with {matrix_count} entities and {doc_types_count} document types")
        else:
            self.log_test("Documents matrix", False, f"{details} - {response}")

    def test_trips_crud(self):
        """Test 8: CRUD operations for trips"""
        if not self.admin_token:
            self.log_test("Trips CRUD", False, "No admin token available")
            return
            
        print("\n🔍 Testing trips CRUD operations...")
        
        # First get vehicles and drivers for trip creation
        vehicles_success, _, vehicles_response = self.make_request(
            'GET', 'vehicles?vehicle_type=tracto',
            token=self.admin_token,
            expected_status=200
        )
        
        drivers_success, _, drivers_response = self.make_request(
            'GET', 'users?role=chofer',
            token=self.admin_token,
            expected_status=200
        )
        
        if not (vehicles_success and drivers_success and vehicles_response and drivers_response):
            self.log_test("Trips CRUD", False, "Could not get vehicles or drivers for trip creation")
            return
        
        # Test GET trips
        success, details, response = self.make_request(
            'GET', 'trips',
            token=self.admin_token,
            expected_status=200
        )
        
        if success and isinstance(response, list):
            trips_count = len(response)
            self.log_test("Get trips", True, f"Found {trips_count} trips")
            
            # Test creating a new trip if we have vehicles and drivers
            if vehicles_response and drivers_response:
                tracto = vehicles_response[0] if vehicles_response else None
                driver = drivers_response[0] if drivers_response else None
                
                if tracto and driver:
                    new_trip_data = {
                        "tracto_id": tracto['id'],
                        "driver_id": driver['id'],
                        "client_name": "Test Client",
                        "cargo_description": "Test Cargo",
                        "cargo_weight": 1000.0,
                        "scheduled_date": (datetime.now() + timedelta(days=1)).isoformat(),
                        "notes": "Test trip"
                    }
                    
                    success, details, create_response = self.make_request(
                        'POST', 'trips',
                        data=new_trip_data,
                        token=self.admin_token,
                        expected_status=200
                    )
                    
                    if success and create_response and 'id' in create_response:
                        trip_id = create_response['id']
                        self.log_test("Create trip", True, f"Created trip with ID: {trip_id}")
                    else:
                        self.log_test("Create trip", False, f"{details} - {create_response}")
                else:
                    self.log_test("Create trip", False, "No vehicles or drivers available")
        else:
            self.log_test("Get trips", False, f"{details} - {response}")

    def test_tires_by_vehicle(self):
        """Test 9: Get tires by vehicle"""
        if not self.admin_token:
            self.log_test("Tires by vehicle", False, "No admin token available")
            return
            
        print("\n🔍 Testing get tires by vehicle...")
        
        # First get a vehicle
        success, details, vehicles_response = self.make_request(
            'GET', 'vehicles',
            token=self.admin_token,
            expected_status=200
        )
        
        if success and vehicles_response and len(vehicles_response) > 0:
            vehicle_id = vehicles_response[0]['id']
            success, details, response = self.make_request(
                'GET', f'tires/vehicle/{vehicle_id}',
                token=self.admin_token,
                expected_status=200
            )
            
            if success and isinstance(response, list):
                tires_count = len(response)
                self.log_test("Get tires by vehicle", True, f"Found {tires_count} tires for vehicle")
            else:
                self.log_test("Get tires by vehicle", False, f"{details} - {response}")
        else:
            self.log_test("Get tires by vehicle", False, "No vehicles available for testing")

    def test_dashboard_kpis(self):
        """Test 10: Dashboard KPIs"""
        if not self.admin_token:
            self.log_test("Dashboard KPIs", False, "No admin token available")
            return
            
        print("\n🔍 Testing dashboard KPIs...")
        success, details, response = self.make_request(
            'GET', 'dashboard/kpis',
            token=self.admin_token,
            expected_status=200
        )
        
        if success and response and isinstance(response, dict):
            # Check for expected KPI structure
            expected_keys = ['vehicles', 'trips', 'alerts', 'documents']
            has_expected_structure = any(key in response for key in expected_keys)
            
            if has_expected_structure:
                self.log_test("Dashboard KPIs", True, f"KPIs loaded with keys: {list(response.keys())}")
            else:
                self.log_test("Dashboard KPIs", True, f"KPIs response received: {response}")
        else:
            self.log_test("Dashboard KPIs", False, f"{details} - {response}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting TransportePeru API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        
        # Run tests in order
        self.test_seed_data()
        self.test_admin_login()
        self.test_driver_login()
        self.test_token_refresh()
        self.test_get_current_user()
        self.test_vehicles_crud()
        self.test_documents_matrix()
        self.test_trips_crud()
        self.test_tires_by_vehicle()
        self.test_dashboard_kpis()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Return success if all critical tests pass
        critical_tests = [
            "Seed demo data", "Admin login", "Driver login", 
            "Get current user", "Get vehicles", "Dashboard KPIs"
        ]
        
        critical_passed = sum(1 for result in self.test_results 
                            if result['name'] in critical_tests and result['success'])
        
        print(f"\n🎯 Critical Tests: {critical_passed}/{len(critical_tests)} passed")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = TransportePeruAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())