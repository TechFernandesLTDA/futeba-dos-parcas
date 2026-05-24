@testable import iosApp
import CoreLocation
import XCTest

final class LocationServiceTests: XCTestCase {

    private var sut: LocationService!

    override func setUp() {
        super.setUp()
        sut = LocationService()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    func testCalculateDistance_identicalCoordinates_returnsZero() {
        let lat = -23.5505
        let lng = -46.6333
        let distance = sut.calculateDistance(fromLat: lat, fromLng: lng, toLat: lat, toLng: lng)
        XCTAssertEqual(distance, 0, accuracy: 0.001)
    }

    func testCalculateDistance_knownCoordinates_returnsExpectedValue() {
        let fromLat = -23.5505
        let fromLng = -46.6333
        let toLat = -23.5610
        let toLng = -46.6560
        let distance = sut.calculateDistance(fromLat: fromLat, fromLng: fromLng, toLat: toLat, toLng: toLng)
        XCTAssertGreaterThan(distance, 0)
        XCTAssertLessThan(distance, 5000)
    }

    func testCalculateDistance_isSymmetric() {
        let fromLat = -23.5505
        let fromLng = -46.6333
        let toLat = -22.9068
        let toLng = -43.1729
        let distanceForward = sut.calculateDistance(fromLat: fromLat, fromLng: fromLng, toLat: toLat, toLng: toLng)
        let distanceBackward = sut.calculateDistance(fromLat: toLat, fromLng: toLng, toLat: fromLat, toLng: fromLng)
        XCTAssertEqual(distanceForward, distanceBackward, accuracy: 0.001)
    }

    func testCalculateDistance_positiveForDifferentCoordinates() {
        let distance = sut.calculateDistance(fromLat: 0, fromLng: 0, toLat: 1, toLng: 1)
        XCTAssertGreaterThan(distance, 0)
    }

    func testCalculateDistance_largeLatitudeValues_returnsValidDistance() {
        let distance = sut.calculateDistance(fromLat: -90, fromLng: -180, toLat: 90, toLng: 180)
        XCTAssertGreaterThan(distance, 0)
        XCTAssertTrue(distance.isFinite)
    }

    func testCalculateDistance_equatorToPole_returnsExpectedOrder() {
        let distance = sut.calculateDistance(fromLat: 0, fromLng: 0, toLat: 90, toLng: 0)
        XCTAssertGreaterThan(distance, 9_000_000)
        XCTAssertLessThan(distance, 11_000_000)
    }

    func testGetCurrentLocation_callsRequestLocation() {
        var didComplete = false
        sut.getCurrentLocation { _, _, error in
            didComplete = true
            XCTAssertNil(error)
        }
    }

    func testLocationManagerDidUpdateLocations_callsCallbackWithLocation() {
        let location = CLLocation(latitude: -23.55, longitude: -46.63)
        var capturedLat: Double?
        var capturedLng: Double?

        sut.getCurrentLocation { lat, lng, error in
            capturedLat = lat
            capturedLng = lng
            XCTAssertNil(error)
        }

        let manager = CLLocationManager()
        sut.locationManager(manager, didUpdateLocations: [location])

        XCTAssertEqual(capturedLat, -23.55, accuracy: 0.001)
        XCTAssertEqual(capturedLng, -46.63, accuracy: 0.001)
    }

    func testLocationManagerDidFailWithError_callsCallbackWithError() {
        var capturedError: String?
        let testError = NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Location denied"])

        sut.getCurrentLocation { _, _, error in
            capturedError = error
        }

        let manager = CLLocationManager()
        sut.locationManager(manager, didFailWithError: testError)

        XCTAssertEqual(capturedError, "Location denied")
    }

    func testLocationManagerDidChangeAuthorization_doesNotCrash() {
        let manager = CLLocationManager()
        sut.locationManagerDidChangeAuthorization(manager)
    }
}
