import Foundation
import CoreLocation

@objc public class LocationService: NSObject, CLLocationManagerDelegate {

    private let manager = CLLocationManager()
    private var locationCallback: ((CLLocation?, String?) -> Void)?

    public override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    @objc public func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    @objc public func getCurrentLocation(
        completion: @escaping (Double, Double, String?) -> Void
    ) {
        locationCallback = { location, error in
            if let error = error {
                completion(0, 0, error)
            } else if let location = location {
                completion(location.coordinate.latitude, location.coordinate.longitude, nil)
            }
        }
        manager.requestLocation()
    }

    @objc public func calculateDistance(
        fromLat: Double,
        fromLng: Double,
        toLat: Double,
        toLng: Double
    ) -> Double {
        let from = CLLocation(latitude: fromLat, longitude: fromLng)
        let to = CLLocation(latitude: toLat, longitude: toLng)
        return from.distance(from: to)
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let location = locations.last {
            locationCallback?(location, nil)
            locationCallback = nil
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        locationCallback?(nil, error.localizedDescription)
        locationCallback = nil
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Handle authorization changes
    }
}
